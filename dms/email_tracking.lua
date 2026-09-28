local lua_util = require "lua_util"
local logger = require "rspamd_logger"

local settings = {
  tracking_base_url = os.getenv("TRACKING_BASE_URL") or "https://example.invalid"
}

local function trim_angle_brackets(value)
  if not value then
    return nil
  end

  return (value:gsub("^<", ""):gsub(">$", ""))
end

local function inject_tracking_pixel(body, message_id)
  local pixel = string.format('<img src="%s/open/%s.png" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;overflow:hidden;" />', settings.tracking_base_url, message_id)
  local replaced, count = body:gsub("</body>", pixel .. "</body>", 1)
  if count == 0 then
    return body .. pixel
  end

  return replaced
end

rspamd_config:register_post_filter(function(task)
  if not task:get_user() then
    return
  end

  local message_id = trim_angle_brackets(task:get_header("Message-ID"))
  if not message_id then
    logger.infox(task, "email_tracking: skipping message without Message-ID")
    return
  end

  local parts = task:get_text_parts() or {}
  for _, part in ipairs(parts) do
    if part:is_html() then
      local content = part:get_content('raw_parsed') or part:get_content() or ''
      local updated = inject_tracking_pixel(content, message_id)
      if updated ~= content then
        part:set_content(updated)
      end
    end
  end
end)
