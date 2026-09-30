-- Pandoc Lua filter: itinerary lists -> timeline.
--
-- A bullet list becomes a timeline when at least half of its items start with a bold date, e.g.
--   - **16 Feb** 🚌 Bus ...        - **Tue 03 Mar** ✈️ Flight ...
--   - **23–31 Jan** 🏨 Hotel ...   - **16–19 outubro** 🏨 ...
-- Each item is split into a date cell and a body cell so CSS can lay them out as columns:
--   <div class="timeline"><ul><li>
--     <div class="timeline-date"><strong>16 Feb</strong></div>
--     <div class="timeline-body">🚌 Bus ...</div>
--   </li></ul></div>
-- Items without a date stay in the timeline with only a body cell. Other lists that happen to
-- start with bold text ("**Dica:**", glossary terms) are left untouched. The markdown files are
-- never changed: this runs at build time (scripts/build-site.mjs, --lua-filter).

local stringify = pandoc.utils.stringify

-- English abbreviations and Portuguese month names (the trip files use both). Matching uses the
-- leading ASCII letters of the month word, so "março" is looked up as "mar".
local MONTHS = {
  jan = true, feb = true, mar = true, apr = true, may = true, jun = true,
  jul = true, aug = true, sep = true, sept = true, oct = true, nov = true, dec = true,
  janeiro = true, fevereiro = true, abril = true, maio = true, junho = true, julho = true,
  agosto = true, setembro = true, outubro = true, novembro = true, dezembro = true
}

-- "Thu 12 Feb", "16 Feb", "23–31 Jan", "16–19 outubro" -> true; "Dica:", "Comer:" -> false.
-- Uses explicit [a-z] rather than %a: in pandoc's Lua, %a also matches the bytes of multi-byte
-- UTF-8 characters, so "16–19 outubro" would capture part of the en dash as the "month".
local function is_date_text(text)
  local rest = text:lower():gsub("^[a-z][a-z][a-z],?%s+", "", 1) -- optional leading weekday
  local month = rest:match("^%d%d?[^a-z]-([a-z]+)")                -- day (or range), then the month word
  return month ~= nil and MONTHS[month] == true
end

-- The Strong date that opens an item's first paragraph, or nil.
local function leading_date(item)
  local first = item[1]
  if not first or (first.t ~= "Plain" and first.t ~= "Para") then
    return nil
  end
  local lead = first.content[1]
  if lead and lead.t == "Strong" and is_date_text(stringify(lead)) then
    return lead
  end
  return nil
end

local function is_gap(inline)
  return inline.t == "Space" or inline.t == "SoftBreak" or inline.t == "LineBreak"
end

local function cell(class, blocks)
  return pandoc.Div(blocks, pandoc.Attr("", { class }))
end

local function timeline_item(item)
  local date = leading_date(item)
  if not date then
    return { cell("timeline-body", item) }
  end

  -- Body = the first paragraph without the date (and the spacing after it) + the item's other
  -- blocks (sub-lists, images, ...).
  local first = item[1]
  local rest = pandoc.List()
  for i = 2, #first.content do
    rest:insert(first.content[i])
  end
  while #rest > 0 and is_gap(rest[1]) do
    rest:remove(1)
  end

  local body = pandoc.List()
  if #rest > 0 then
    body:insert(first.t == "Para" and pandoc.Para(rest) or pandoc.Plain(rest))
  end
  for i = 2, #item do
    body:insert(item[i])
  end

  return { cell("timeline-date", { pandoc.Plain({ date }) }), cell("timeline-body", body) }
end

function BulletList(list)
  local dated = 0
  for _, item in ipairs(list.content) do
    if leading_date(item) then
      dated = dated + 1
    end
  end
  if dated == 0 or dated * 2 < #list.content then
    return nil
  end

  local items = pandoc.List()
  for _, item in ipairs(list.content) do
    items:insert(timeline_item(item))
  end
  return pandoc.Div({ pandoc.BulletList(items) }, pandoc.Attr("", { "timeline" }))
end
