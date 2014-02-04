// Copyright 2006, 2014 The University of British Columbia and Derek Poon
// Released under the Mozilla Public License, v2.0.

gMessageListeners.push({
    onStartHeaders: function() {
        gExpandedHeaderView['rt-ticket'] =
            new createHeaderEntry('expanded', { name: 'rt-ticket' });
    },

    // Thunderbird 1.0 never calls gMessageListeners.onEndMsgHeaders()
    onEndHeaders: function() {}
});

messageHeaderSink.oldOnEndMsgHeaders = messageHeaderSink.onEndMsgHeaders;

messageHeaderSink.onEndMsgHeaders = function(url) {
    try {
        var rtTicketValue = url.mimeHeaders.extractHeader('rt-ticket', false);
    } catch (messageNotLoaded) {
        return;
    }
    if (rtTicketValue != null) {
        RTTicket.log.debug('Found RT-Ticket header: ' + rtTicketValue);

        var headerEntry = gExpandedHeaderView['rt-ticket'];
        headerEntry.outputFunction(headerEntry, rtTicketValue);
        headerEntry.valid = true;
        updateHeaderViews();
    }

    if (messageHeaderSink.oldOnEndMsgHeaders) {
        messageHeaderSink.oldOnEndMsgHeaders(url);
    }
};

/* vim: set shiftwidth=4 expandtab: */
