local lua_mime = require "lua_mime"
local rspamd_logger = require "rspamd_logger"
local rspamd_http = require "rspamd_http"
local ucl = require "ucl"

local TRACKING_DOMAIN = "__TRACKING_BASE_URL__"
local TRACKING_API_TOKEN = "__TRACKING_API_TOKEN__"
local TRACKING_BLACKLIST_PATH = "/etc/rspamd/tracking-blacklist.txt"

local function is_blacklisted_sender(address)
    local blacklist = io.open(TRACKING_BLACKLIST_PATH, "r")

    if not blacklist then
        return false
    end

    for blacklisted_sender in blacklist:lines() do
        if address:lower() == blacklisted_sender:lower() then
            blacklist:close()
            return true
        end
    end

    blacklist:close()
    return false
end

local function newline(task)
    local t = task:get_newlines_type()

    if t == "cr" then
        return "\r"
    elseif t == "lf" then
        return "\n"
    end

    return "\r\n"
end

local function report_message(task, uid, message_id, sender_address, user)
    if TRACKING_API_TOKEN == "" then
        return
    end

    local recipients = {}
    for _, rcpt in ipairs(task:get_recipients("mime") or {}) do
        if rcpt.addr then
            recipients[#recipients + 1] = rcpt.addr
        end
    end

    local body = ucl.to_format({
        uid = uid,
        message_id = message_id,
        subject = task:get_subject(),
        sender = sender_address,
        recipients = recipients,
        user = user,
    }, "json-compact")

    rspamd_http.request({
        task = task,
        url = string.format("https://%s/api/messages", TRACKING_DOMAIN),
        method = "POST",
        body = body,
        headers = {
            ["Content-Type"] = "application/json",
            ["Authorization"] = "Bearer " .. TRACKING_API_TOKEN,
        },
        timeout = 5,
        callback = function(err, code)
            if err or (code ~= 200 and code ~= 204) then
                rspamd_logger.warnx(
                    task,
                    "TRACKING_PIXEL: metadata report failed: %s (HTTP %s)",
                    tostring(err),
                    tostring(code)
                )
            end
        end,
    })
end

local function inject_tracking_pixel(task)
    local user = task:get_user()

    -- Only modify authenticated outbound mail.
    if not user then
        return
    end

    local sender = task:get_from("mime")
    local sender_address = sender and sender.addr

    if sender_address and is_blacklisted_sender(sender_address) then
        rspamd_logger.infox(
            task,
            "TRACKING_PIXEL: skipping blacklisted sender %s",
            sender_address
        )
        return
    end

    local message_id = task:get_message_id()

    if not message_id then
        rspamd_logger.warnx(
            task,
            "TRACKING_PIXEL: no Message-ID"
        )
        return
    end

    local uid = task:get_uid()

    local pixel = string.format(
        '<img src="https://%s/open/%s.png" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;overflow:hidden;" />',
        TRACKING_DOMAIN,
        uid
    )

    rspamd_logger.infox(
        task,
        "TRACKING_PIXEL: injecting pixel for %s (%s)",
        uid,
        message_id
    )

    report_message(task, uid, message_id, sender_address, user)

    local rewrite = lua_mime.add_text_footer(
        task,
        pixel,
        nil
    ) or {}

    local out = {}
    local seen_cte = false
    local newline_s = newline(task)

    local function process_header(name, hdr)
        if rewrite.need_rewrite_ct then

            if name:lower() == "content-type" then
                local nct = string.format(
                    "Content-Type: %s/%s; charset=utf-8",
                    rewrite.new_ct.type,
                    rewrite.new_ct.subtype
                )

                out[#out + 1] = nct

                task:set_milter_reply({
                    remove_headers = {
                        ["Content-Type"] = 0,
                    },
                })

                task:set_milter_reply({
                    add_headers = {
                        ["Content-Type"] = nct,
                    },
                })

                return

            elseif name:lower() == "content-transfer-encoding" then
                out[#out + 1] =
                    "Content-Transfer-Encoding: quoted-printable"

                task:set_milter_reply({
                    remove_headers = {
                        ["Content-Transfer-Encoding"] = 0,
                    },
                })

                task:set_milter_reply({
                    add_headers = {
                        ["Content-Transfer-Encoding"] = "quoted-printable",
                    },
                })

                seen_cte = true
                return
            end
        end

        out[#out + 1] = hdr.raw:gsub("\r?\n?$", "")
    end

    task:headers_foreach(
        process_header,
        { full = true }
    )

    if not seen_cte and rewrite.need_rewrite_ct then
        out[#out + 1] =
            "Content-Transfer-Encoding: quoted-printable"
    end

    -- End of headers.
    out[#out + 1] = newline_s

    if rewrite.out then
        for _, part in ipairs(rewrite.out) do
            out[#out + 1] = part
        end
    else
        out[#out + 1] = task:get_rawbody()
    end

    -- Convert Rspamd's rewrite result into the format expected
    -- by task:set_message().
    local out_parts = {}

    for _, item in ipairs(out) do
        if type(item) ~= "table" then
            out_parts[#out_parts + 1] = item
            out_parts[#out_parts + 1] = newline_s
        else
            local removePrefix = "--\x0D\x0A Content-Type"

            if string.lower(
                string.sub(
                    tostring(item[1]),
                    1,
                    string.len(removePrefix)
                )
            ) == string.lower(removePrefix) then
                item[1] = string.sub(
                    tostring(item[1]),
                    string.len("--\x0D\x0A") + 1
                )
            end

            out_parts[#out_parts + 1] = item[1]

            if item[2] then
                out_parts[#out_parts + 1] = newline_s
            end
        end
    end

    local ok, size = task:set_message(out_parts)

    if not ok then
        rspamd_logger.errx(
            task,
            "TRACKING_PIXEL: task:set_message() failed, size=%s",
            tostring(size)
        )

        return
    end

    rspamd_logger.infox(
        task,
        "TRACKING_PIXEL: message rewritten successfully, size=%s",
        tostring(size)
    )
end

rspamd_config:register_symbol({
    name = "TRACKING_PIXEL",
    type = "prefilter",

    callback = function(task)
        inject_tracking_pixel(task)
    end,

    priority = 1,
})