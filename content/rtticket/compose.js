// Copyright 2006, 2014 The University of British Columbia and Derek Poon
// Released under the Mozilla Public License, v2.0.

RTTicket.compose = {};

// Allow digits only.  See also RTTicket.associate.controller.onEvent
RTTicket.compose.ticketInputHandler = function ticketInputHandler(event) {
    var ticketInput = document.getElementById('compose-ticketnumber-input');
    switch (event.type) {
      case 'keypress':
        if (event.target == ticketInput) {
            // Allow digits only.  Make some exceptions to allow pasting
            // (Shift-Insert, Cmd-V, Ctrl-V).
            var keyChar = String.fromCharCode(event.charCode);
            return /\d/.test(keyChar)       // Allow digits
                   || event.charCode == 0   // or non-printable, e.g. Ins
                   || event.metaKey         // or Cmd key on Mac
                   || event.ctrlKey;        // or Ctrl key
        }
        break;
      case 'keyup':
      case 'mouseup':
        if (event.target == ticketInput) {
            // Enable/disable the OK button depending on whether there is
            // text in the ticket number input field.  Filter again in case
            // non-digits got there by pasting.  (We handle mouseup because
            // it's possible to paste with the middle mouse button in X11.)
            ticketInput.value = ticketInput.value.replace(/\D/g, '');
            goUpdateCommand('cmd_rtticket_associate_associate');

            if (event.keyCode == 13) {      // VK_ENTER
                goDoCommand('cmd_rtticket_associate_associate');
            }
        }
        break;
    }
    return true;
};

RTTicket.compose.onsend = function onsend(event) {
    // RTTicket.log.debug('RTTicket.compose.onsend(' + event + ')');
    var ticketInput = document.getElementById('compose-ticketnumber-input');
    if (ticketInput.value && ticketInput.value.length) {
        var senderEmail = getCurrentIdentity().email;
        var varBindings = {
            ticket: ticketInput.value,
            mailfrom: senderEmail,
            mailfromdomain: senderEmail.substr(1 + senderEmail.lastIndexOf('@')),
            rtdomain: RTTicket.prefs.rtDomain
        };
        var bccAddr = RTTicket.interpolateVars(RTTicket.compose.prefs.bcc,
                                               varBindings);

        if (bccAddr != null && bccAddr.length) {
            var compFields = gMsgCompose.compFields;

            if (compFields.bcc != null && compFields.bcc.length) {
                compFields.bcc += ', ' + bccAddr;
            } else {
                compFields.bcc = bccAddr;
            }

            var replyToAddr = RTTicket.interpolateVars(RTTicket.compose.prefs.replyTo,
                                                       varBindings);
            if (compFields.replyTo != null && compFields.replyTo.length) {
                compFields.replyTo += ', ' + replyToAddr;
            } else {
                compFields.replyTo = replyToAddr;
            }

            // The Errors-To header is crucial for avoiding a mail loop
            // in case the RT mail gateway encounters an error.
            // (RT 3.4 is vulnerable to this mail loop.)
            compFields.otherRandomHeaders += RTTicket.interpolateVars(
                'Errors-To: ' + RTTicket.compose.prefs.errorsTo + '\r\n' +
                  'X-RT-User: ' + RTTicket.prefs.rtUser + '\r\n' +
                  'RT-Ticket: $rtdomain #$ticket\r\n',
                varBindings
            );
        }
    }
}

RTTicket.compose.setup = function setup(windowLoadEvent) {
    RTTicket.setup(windowLoadEvent);

    // Install listeners
    RTTicket.compose.prefs = new RTPrefsManager('extensions.rtticket.compose.');
    RTTicket.compose.prefs.register('bcc', function(prefBranch, prefName) {
        RTTicket.compose.prefs.bcc = prefBranch.getCharPref(prefName);
    });
    RTTicket.compose.prefs.register('replyTo', function(prefBranch, prefName) {
        RTTicket.compose.prefs.replyTo = prefBranch.getCharPref(prefName);
    });
    RTTicket.compose.prefs.register('errorsTo', function(prefBranch, prefName) {
        RTTicket.compose.prefs.errorsTo = prefBranch.getCharPref(prefName);
    });

    function populateTicketField(msgComposeParams) {
        var ticketInput = document.getElementById('compose-ticketnumber-input');
        function setTicketField(rtticketHeaderName, rtticketHeaderValue) {
            var match = /(.*)\s+#(\d+)$/.exec(rtticketHeaderValue);
            if (match && (match[1] == RTTicket.prefs.rtDomain)) {
                ticketInput.value = match[2];
            }
        }
        function clearTicketField() {
            ticketInput.value = '';
        }
        var origMsgURI = msgComposeParams.originalMsgURI;
        if (origMsgURI) {
            RTTicket.actOnHeader(origMsgURI, /RT-Ticket/i,
                                 setTicketField, clearTicketField);
        } else {
            clearTicketField();
        }
    }
    populateTicketField(windowLoadEvent.currentTarget.arguments[0]);

    RTTicket.compose.oldComposeStartup = ComposeStartup;
    ComposeStartup = function ComposeStartup(recycled, params) {
        RTTicket.compose.oldComposeStartup(recycled, params);
        populateTicketField(params);
    };
    RTTicket.log.debug('Added hook to populate composer Ticket field');

    var window = document.getElementById('msgcomposeWindow');
    window.addEventListener('compose-send-message',
                            RTTicket.compose.onsend,
                            false);
};

RTTicket.compose.teardown = function teardown(windowUnloadEvent) {
    // Unnstall listeners
    var window = document.getElementById('msgcomposeWindow');
    window.removeEventListener('compose-send-message',
                               RTTicket.compose.onsend,
                               false);

    ComposeStartup = RTTicket.compose.oldComposeStartup;
    RTTicket.log.debug('Removed hook to populate composer Ticket field');

    RTTicket.compose.prefs.unregister('bcc');
    RTTicket.compose.prefs.unregister('replyTo');
    RTTicket.compose.prefs.unregister('errorsTo');
    RTTicket.compose.prefs = null;

    RTTicket.teardown(windowUnloadEvent);
};

/* vim: set shiftwidth=4 expandtab: */
