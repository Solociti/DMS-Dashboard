local lua_mime = require "lua_mime"
local rspamd_logger = require "rspamd_logger"
local rspamd_trie = require "rspamd_trie"

local function url_encode(value)
  return (value:gsub("[^%w%-_%.~]", function(character)
    return string.format("%%%02X", string.byte(character))
  end))
end

local function build_pixel(message_id)
  local tracking_base_url = (os.getenv("TRACKING_BASE_URL") or ""):gsub("/$", "")
  if tracking_base_url == "" then
    return nil
  end

  return string.format(
    '<img src="%s/open/%s.png" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;overflow:hidden;" />',
    tracking_base_url,
    url_encode(message_id)
  )
end

local function append_newline(buffer, newline)
  buffer[#buffer + 1] = newline
end

rspamd_config:register_symbol({
  name = "EMAIL_TRACKING_PIXEL",
  type = "postfilter",
  priority = 5,
  flags = "empty,nostat",
  score = 0.0,
  callback = function(task)
    if not task:get_user() then
      return
    end

    local message_id = task:get_message_id()
    if not message_id then
      rspamd_logger.infox(task, "email_tracking: skipping message without Message-ID")
      return
    end

    local pixel = build_pixel(message_id)
    if not pixel then
      rspamd_logger.infox(task, "email_tracking: skipping message because TRACKING_BASE_URL is unset")
      return
    end

    local existing_pixel_pattern = rspamd_trie.create({ pixel }, rspamd_trie.flags.icase)
    local existing_pixel = lua_mime.multipattern_text_replace(task, existing_pixel_pattern, { pixel })
    if existing_pixel and existing_pixel.out then
      return
    end

    local rewrite = lua_mime.add_text_footer(task, pixel, nil)

    if not rewrite or not rewrite.out then
      return
    end

    local newline = "\r\n"
    if task:get_newlines_type() == "lf" then
      newline = "\n"
    end

    local headers = {}
    local seen_content_transfer_encoding = false

    task:headers_foreach(function(name, header)
      local lower_name = name:lower()

      if rewrite.need_rewrite_ct and lower_name == "content-type" then
        headers[#headers + 1] = string.format(
          "Content-Type: %s/%s; charset=utf-8",
          rewrite.new_ct.type,
          rewrite.new_ct.subtype
        )
        return
      end

      if rewrite.need_rewrite_ct and lower_name == "content-transfer-encoding" then
        headers[#headers + 1] = string.format(
          "Content-Transfer-Encoding: %s",
          rewrite.new_cte or "quoted-printable"
        )
        seen_content_transfer_encoding = true
        return
      end

      headers[#headers + 1] = header.raw:gsub("\r?\n?$", "")
    end, { full = true })

    if rewrite.need_rewrite_ct and not seen_content_transfer_encoding then
      headers[#headers + 1] = string.format(
        "Content-Transfer-Encoding: %s",
        rewrite.new_cte or "quoted-printable"
      )
    end

    local output = {}

    for _, header in ipairs(headers) do
      output[#output + 1] = header
      append_newline(output, newline)
    end

    append_newline(output, newline)

    for _, part in ipairs(rewrite.out) do
      if type(part) == "table" then
        output[#output + 1] = part[1]
        if part[2] then
          append_newline(output, newline)
        end
      else
        output[#output + 1] = part
        append_newline(output, newline)
      end
    end

    local ok = task:set_message(output)
    if not ok then
      rspamd_logger.errx(task, "email_tracking: failed to rewrite message %s", message_id)
    end
  end
})
