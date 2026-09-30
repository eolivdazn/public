// "Photos" gallery on the trip pages: trip photos (/api/photos) and food-expense photos
// (/api/expenses) together, grouped by day as photo-first cards, with an All / Trip / Food filter
// and a full-screen viewer (native <dialog>) that pages through every visible photo. Trip photos
// can be deleted from the viewer. Copied to site/assets/ at build time (build-site.mjs).
//
// The pure helpers at the top are also loaded by scripts/food-gallery.test.mjs, which runs this
// file in a Node vm context that provides `module`; in the browser there is no `module`, so the
// DOM wiring below runs instead.
(function () {
  "use strict";

  var STAR_CHARS = "★★★★★";

  function byDateThenCreated(a, b) {
    return (a.date || "").localeCompare(b.date || "") || (a.createdAt || "").localeCompare(b.createdAt || "");
  }

  function usablePhotos(photos) {
    return (photos || []).filter(function (photo) {
      return photo && typeof photo.url === "string" && photo.url;
    });
  }

  // Food expenses that have at least one photo with a usable URL, as gallery items, in trip order.
  function galleryEntries(entries) {
    return (entries || [])
      .filter(function (entry) {
        return entry && entry.category === "food" && Array.isArray(entry.photos);
      })
      .map(function (entry) {
        return Object.assign({}, entry, { kind: "food", photos: usablePhotos(entry.photos) });
      })
      .filter(function (entry) {
        return entry.photos.length > 0;
      })
      .sort(byDateThenCreated);
  }

  // Trip photos as gallery items: dated by the photo's own EXIF day, else by when it was added.
  function tripPhotoItems(photos) {
    return (photos || [])
      .filter(function (photo) {
        return photo && typeof photo.url === "string" && photo.url;
      })
      .map(function (photo) {
        return {
          id: photo.id,
          kind: "trip",
          tripSlug: photo.tripSlug,
          date: photo.takenOn || (photo.createdAt || "").slice(0, 10),
          createdAt: photo.createdAt,
          description: photo.caption || null,
          rating: null,
          location: photo.location || null,
          createdBy: photo.createdBy || null,
          photos: [{ url: photo.url }]
        };
      })
      .sort(byDateThenCreated);
  }

  // Food and trip items together, in trip order.
  function galleryItems(entries, photos) {
    return galleryEntries(entries).concat(tripPhotoItems(photos)).sort(byDateThenCreated);
  }

  function filterItems(items, filter) {
    if (filter !== "trip" && filter !== "food") {
      return items;
    }
    return items.filter(function (item) {
      return item.kind === filter;
    });
  }

  // [{ date, entries }] in the order the (already sorted) items arrive.
  function groupEntriesByDay(entries) {
    var groups = [];
    entries.forEach(function (entry) {
      var date = entry.date || "";
      var last = groups[groups.length - 1];
      if (last && last.date === date) {
        last.entries.push(entry);
      } else {
        groups.push({ date: date, entries: [entry] });
      }
    });
    return groups;
  }

  // Every photo of the given items, in display order, so the viewer can page across items.
  function flattenPhotos(entries) {
    var photos = [];
    entries.forEach(function (entry) {
      entry.photos.forEach(function (photo, photoIndex) {
        photos.push({ url: photo.url, entry: entry, photoIndex: photoIndex, index: photos.length });
      });
    });
    return photos;
  }

  // "2026-10-17" -> "Sat 17 Oct". Parsed as UTC so the label never shifts with the viewer's timezone.
  function formatDayLabel(isoDate) {
    var date = new Date(isoDate + "T00:00:00Z");
    if (!isoDate || isNaN(date.getTime())) {
      return "Undated";
    }
    var parts = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC"
    }).formatToParts(date);
    var get = function (type) {
      var part = parts.find(function (p) {
        return p.type === type;
      });
      return part ? part.value : "";
    };
    return get("weekday") + " " + get("day") + " " + get("month");
  }

  function itemTitle(entry) {
    return entry.description || (entry.kind === "trip" ? "Trip photo" : "Dish");
  }

  // Accessible name for a card button, e.g. "Open 3 photos: Paella valenciana, rated 4.5 out of 5".
  function cardLabel(entry) {
    var count = entry.photos.length;
    var label = "Open " + (count === 1 ? "photo" : count + " photos") + ": " + itemTitle(entry);
    return entry.rating ? label + ", rated " + entry.rating + " out of 5" : label;
  }

  // "7 photos · 3 days"
  function summaryLabel(entries) {
    var photoCount = entries.reduce(function (sum, entry) {
      return sum + entry.photos.length;
    }, 0);
    var days = groupEntriesByDay(entries).length;
    return photoCount + (photoCount === 1 ? " photo" : " photos") + " · " + days + (days === 1 ? " day" : " days");
  }

  var helpers = {
    galleryEntries: galleryEntries,
    tripPhotoItems: tripPhotoItems,
    galleryItems: galleryItems,
    filterItems: filterItems,
    groupEntriesByDay: groupEntriesByDay,
    flattenPhotos: flattenPhotos,
    formatDayLabel: formatDayLabel,
    cardLabel: cardLabel,
    summaryLabel: summaryLabel
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
    return;
  }

  // ---------- Browser wiring ----------

  var section = document.getElementById("trip-food-gallery");
  var dialog = document.getElementById("trip-food-lightbox");
  var slug = location.pathname.split("/").pop().replace(/\.html$/, "");
  if (!section || !dialog || !slug) {
    return;
  }

  var state = { items: [], filter: "all" };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function stars(rating) {
    var wrap = el("span", "trip-food-stars");
    wrap.setAttribute("aria-hidden", "true");
    wrap.appendChild(el("span", "trip-food-stars-empty", STAR_CHARS));
    var filled = el("span", "trip-food-stars-filled", STAR_CHARS);
    filled.style.width = (Math.min(rating, 5) / 5) * 100 + "%";
    wrap.appendChild(filled);
    return wrap;
  }

  // ----- Viewer -----

  var viewer = {
    photos: [],
    index: 0,
    trigger: null,
    confirmingDelete: false,
    image: dialog.querySelector(".trip-lightbox-image"),
    counter: dialog.querySelector(".trip-lightbox-counter"),
    title: dialog.querySelector(".trip-lightbox-title"),
    meta: dialog.querySelector(".trip-lightbox-meta"),
    mapLink: dialog.querySelector("[data-lightbox-map]"),
    originalLink: dialog.querySelector("[data-lightbox-original]"),
    deleteButton: dialog.querySelector("[data-lightbox-delete]"),
    error: dialog.querySelector(".trip-lightbox-error"),
    prev: dialog.querySelector("[data-lightbox-prev]"),
    next: dialog.querySelector("[data-lightbox-next]")
  };

  function resetDelete() {
    viewer.confirmingDelete = false;
    viewer.deleteButton.disabled = false;
    viewer.deleteButton.textContent = "Delete photo";
    viewer.deleteButton.classList.remove("is-confirming");
  }

  function show(index) {
    var total = viewer.photos.length;
    viewer.index = (index + total) % total;
    var photo = viewer.photos[viewer.index];
    var entry = photo.entry;

    viewer.image.classList.remove("is-loaded");
    viewer.image.src = photo.url;
    viewer.image.alt = entry.description ? "Photo: " + entry.description : entry.kind === "trip" ? "Trip photo" : "Food photo";
    viewer.counter.textContent = viewer.index + 1 + " / " + total;
    viewer.title.textContent = itemTitle(entry);

    viewer.meta.textContent = "";
    if (entry.rating) {
      viewer.meta.appendChild(stars(entry.rating));
      viewer.meta.appendChild(el("span", "trip-lightbox-rating", entry.rating + "/5"));
    }
    viewer.meta.appendChild(el("span", null, formatDayLabel(entry.date)));
    if (entry.createdBy && entry.createdBy.userDetails) {
      viewer.meta.appendChild(el("span", null, "Added by " + entry.createdBy.userDetails));
    }

    var place = entry.location;
    viewer.mapLink.hidden = !place;
    if (place) {
      viewer.mapLink.href = "https://www.google.com/maps?q=" + place.latitude + "," + place.longitude;
    }
    viewer.originalLink.href = photo.url;

    // Only trip photos are deleted here; food photos belong to their expense.
    viewer.deleteButton.hidden = entry.kind !== "trip";
    resetDelete();
    viewer.error.textContent = "";

    // Warm the cache for the next photo so paging feels instant.
    if (total > 1) {
      new Image().src = viewer.photos[(viewer.index + 1) % total].url;
    }
  }

  function openViewer(index, trigger) {
    viewer.trigger = trigger;
    show(index);
    document.documentElement.classList.add("has-lightbox");
    dialog.showModal();
  }

  function deleteCurrentPhoto() {
    var entry = viewer.photos[viewer.index].entry;
    if (!viewer.confirmingDelete) {
      viewer.confirmingDelete = true;
      viewer.deleteButton.textContent = "Confirm delete";
      viewer.deleteButton.classList.add("is-confirming");
      return;
    }

    viewer.deleteButton.disabled = true;
    viewer.deleteButton.textContent = "Deleting…";
    var params = new URLSearchParams({ id: entry.id, tripSlug: slug });
    fetch("/api/photos?" + params.toString(), { method: "DELETE" })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return null;
          })
          .then(function (body) {
            if (!res.ok) {
              throw new Error((body && body.error) || "Could not delete the photo (" + res.status + ").");
            }
          });
      })
      .then(function () {
        state.items = state.items.filter(function (item) {
          return item !== entry;
        });
        viewer.trigger = null;
        dialog.close();
        render();
        section.querySelector(".trip-food-gallery-subtitle").focus();
      })
      .catch(function (error) {
        resetDelete();
        viewer.error.textContent = error.message;
      });
  }

  viewer.image.addEventListener("load", function () {
    viewer.image.classList.add("is-loaded");
  });
  viewer.prev.addEventListener("click", function () {
    show(viewer.index - 1);
  });
  viewer.next.addEventListener("click", function () {
    show(viewer.index + 1);
  });
  viewer.deleteButton.addEventListener("click", deleteCurrentPhoto);
  dialog.querySelector("[data-lightbox-close]").addEventListener("click", function () {
    dialog.close();
  });
  // Clicking the dark area around the photo closes the viewer, like most photo viewers.
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  dialog.addEventListener("keydown", function (event) {
    if (viewer.photos.length < 2) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(viewer.index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      show(viewer.index + 1);
    }
  });
  dialog.addEventListener("close", function () {
    document.documentElement.classList.remove("has-lightbox");
    if (viewer.trigger && document.contains(viewer.trigger)) {
      viewer.trigger.focus();
    }
  });

  // Horizontal swipe on the photo pages through photos (vertical movement is left alone).
  var swipeStart = null;
  var figure = dialog.querySelector(".trip-lightbox-figure");
  figure.addEventListener("pointerdown", function (event) {
    swipeStart = { x: event.clientX, y: event.clientY };
  });
  figure.addEventListener("pointerup", function (event) {
    if (!swipeStart || viewer.photos.length < 2) {
      swipeStart = null;
      return;
    }
    var dx = event.clientX - swipeStart.x;
    var dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      show(viewer.index + (dx < 0 ? 1 : -1));
    }
  });
  figure.addEventListener("pointercancel", function () {
    swipeStart = null;
  });

  // ----- Filter chips -----

  var filters = section.querySelector(".trip-gallery-filters");
  filters.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-filter]");
    if (!button) {
      return;
    }
    state.filter = button.getAttribute("data-filter");
    render();
  });

  // ----- Cards -----

  function createCard(entry, firstPhotoIndex) {
    var item = el("li");
    var button = el("button", "trip-food-card");
    button.type = "button";
    button.setAttribute("aria-label", cardLabel(entry));

    var img = el("img", "trip-food-card-image");
    img.src = entry.photos[0].url;
    img.alt = "";
    img.width = 400;
    img.height = 300;
    img.loading = "lazy";
    img.decoding = "async";
    button.appendChild(img);

    if (entry.photos.length > 1) {
      // The "+2" is drawn by CSS from data-count, so it isn't text content: the button's accessible
      // name says "3 photos" instead, and visible text must stay part of that name (WCAG 2.5.3).
      var badge = el("span", "trip-food-card-count");
      badge.setAttribute("data-count", "+" + (entry.photos.length - 1));
      badge.setAttribute("aria-hidden", "true");
      button.appendChild(badge);
    }

    // Trip photos without a caption show just the photo.
    var caption = el("span", "trip-food-card-caption");
    caption.setAttribute("aria-hidden", "true");
    if (entry.description || entry.kind === "food") {
      caption.appendChild(el("span", "trip-food-card-title", itemTitle(entry)));
    }
    if (entry.rating) {
      caption.appendChild(stars(entry.rating));
    }
    if (caption.childNodes.length > 0) {
      button.appendChild(caption);
    }

    button.addEventListener("click", function () {
      openViewer(firstPhotoIndex, button);
    });
    item.appendChild(button);
    return item;
  }

  function render() {
    var hasTrip = state.items.some(function (item) {
      return item.kind === "trip";
    });
    var hasFood = state.items.some(function (item) {
      return item.kind === "food";
    });
    if (!(hasTrip && hasFood)) {
      state.filter = "all";
    }

    var visible = filterItems(state.items, state.filter);
    var photos = flattenPhotos(visible);
    var firstPhotoIndexByEntry = new Map();
    photos.forEach(function (photo) {
      if (photo.photoIndex === 0) {
        firstPhotoIndexByEntry.set(photo.entry, photo.index);
      }
    });

    viewer.photos = photos;
    var single = photos.length < 2;
    viewer.prev.hidden = single;
    viewer.next.hidden = single;

    // The filter only makes sense when both kinds are on the page.
    filters.hidden = !(hasTrip && hasFood);
    filters.querySelectorAll("button[data-filter]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-filter") === state.filter));
    });

    section.querySelector(".trip-food-gallery-subtitle").textContent = summaryLabel(state.items);
    var days = section.querySelector(".trip-food-days");
    days.textContent = "";
    groupEntriesByDay(visible).forEach(function (group) {
      var day = el("section", "trip-food-day");
      var heading = el("h3", "trip-food-day-title");
      var time = el("time", null, formatDayLabel(group.date));
      if (group.date) {
        time.dateTime = group.date;
      }
      heading.appendChild(time);
      day.appendChild(heading);

      var grid = el("ul", "trip-food-grid");
      group.entries.forEach(function (entry) {
        grid.appendChild(createCard(entry, firstPhotoIndexByEntry.get(entry)));
      });
      day.appendChild(grid);
      days.appendChild(day);
    });

    section.hidden = state.items.length === 0;
  }

  function getJson(url) {
    return fetch(url)
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .catch(function () {
        return null;
      });
  }

  function load() {
    var query = "?tripSlug=" + encodeURIComponent(slug);
    // Either source may be unavailable (e.g. a plain local server); show whatever loads.
    return Promise.all([getJson("/api/expenses" + query), getJson("/api/photos" + query)]).then(function (results) {
      state.items = galleryItems(results[0] && results[0].entries, results[1] && results[1].photos);
      render();
    });
  }

  // The trip page's "Add photos" card announces new uploads so the gallery can refresh in place.
  window.addEventListener("trip-photos:changed", function () {
    load();
  });

  load();
})();
