local lua_mime = require "lua_mime"
local rspamd_logger = require "rspamd_logger"

local TRACKING_BASE_URL = "__TRACKING_BASE_URL__"

local function inject_tracking_pixel(task)
    -- Only process authenticated submissions.
    -- This prevents incoming mail from being modified.
    if not task:get_user() then
        return
    end

    local message_id = task:get_message_id()
    if not message_id then
        rspamd_logger.infox(task, "tracking pixel: message has no Message-ID")
        return
    end

    local text_parts = task:get_text_parts()

    -- Don't inject twice if the message gets processed more than once.
    for _, part in ipairs(text_parts or {}) do
        if part:is_html() then
            local html = tostring(part:get_content("raw_utf"))

            if html:find(TRACKING_BASE_URL, 1, true) then
                return
            end
        end
    end

    local pixel = string.format(
        '<img src="%s/open/%s.png" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;overflow:hidden;" />',
        TRACKING_BASE_URL,
        message_id
    )

    -- Rewrite HTML MIME parts.
    local rewrite = lua_mime.add_text_footer(task, pixel, "")

    if not rewrite or not rewrite.out then
        return
    end

    local newline = "\r\n"

    local newline_type = task:get_newlines_type()
    if newline_type == "cr" then
        newline = "\r"
    elseif newline_type == "lf" then
        newline = "\n"
    end

    local output = {}
    local seen_cte = false

    task:headers_foreach(function(name, hdr)
        if rewrite.need_rewrite_ct then
            local lname = name:lower()

            if lname == "content-type" then
                local boundary = ""

                if rewrite.new_ct.boundary then
                    boundary = string.format(
                        '; boundary="%s"',
                        rewrite.new_ct.boundary
                    )
                end

                output[#output + 1] = string.format(
                    "Content-Type: %s/%s; charset=utf-8%s",
                    rewrite.new_ct.type,
                    rewrite.new_ct.subtype,
                    boundary
                )

                task:set_milter_reply({
                    remove_headers = {
                        ["Content-Type"] = 0
                    }
                })

                task:set_milter_reply({
                    add_headers = {
                        ["Content-Type"] = string.format(
                            "%s/%s; charset=utf-8%s",
                            rewrite.new_ct.type,
                            rewrite.new_ct.subtype,
                            boundary
                        )
                    }
                })

                return
            elseif lname == "content-transfer-encoding" then
                output[#output + 1] =
                    "Content-Transfer-Encoding: quoted-printable"

                task:set_milter_reply({
                    remove_headers = {
                        ["Content-Transfer-Encoding"] = 0
                    }
                })

                task:set_milter_reply({
                    add_headers = {
                        ["Content-Transfer-Encoding"] = "quoted-printable"
                    }
                })

                seen_cte = true
                return
            end
        end

        output[#output + 1] = hdr.raw:gsub("\r?\n?$", "")
    end, { full = true })

    output[#output + 1] = newline

    for _, item in ipairs(rewrite.out) do
        if type(item) ~= "table" then
            output[#output + 1] = item
            output[#output + 1] = newline
        else
            -- Rspamd's MIME rewrite representation can include a
            -- leading CRLF before Content-Type.
            local prefix = "--\r\nContent-Type"

            if string.lower(
                string.sub(tostring(item[1]), 1, #prefix)
            ) == string.lower(prefix) then
                item[1] =
                    string.sub(
                        tostring(item[1]),
                        #("--\r\n") + 1
                    )
            end

            output[#output + 1] = item[1]

            if item[2] then
                output[#output + 1] = newline
            end
        end
    end

    task:set_message(output)
end


rspamd_config:register_symbol({
    name = "TRACKING_PIXEL",
    type = "prefilter",

    callback = function(task)
        inject_tracking_pixel(task)
    end,

    priority = 1
})