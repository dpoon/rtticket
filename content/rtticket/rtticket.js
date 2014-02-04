// Copyright 2006, 2014 The University of British Columbia and Derek Poon
// Released under the Mozilla Public License, v2.0.

/*********************************************************************
 * Initialization
 ********************************************************************/

var RTTicket = {
    // RTTicketLogger is defined in rtticket-debug.js
    log: new RTTicketLogger(),
    prefs: []
};
RTTicket.controller = {
    supportsCommand: function(command) {
        switch (command) {
          case 'cmd_rtticket_associate':
            return true;
          default:
            return false;
        }
    },

    isCommandEnabled: function(command) {
        switch (command) {
          case 'cmd_rtticket_associate':
            return GetNumSelectedMessages() > 0;
          default:
            return false;
        }
    },

    doCommand: function(command) {
        RTTicket.log.debug('doCommand: ' + command);
        if (!this.isCommandEnabled(command)) { return; }
        switch (command) {
          case 'cmd_rtticket_associate':
            RTTicket.associate();
            break;
        }
    },

    onEvent: function(event) {
        RTTicket.log.debug('onEvent(' + event + ')');
    }
};

RTTicket.setup = function setup(windowLoadEvent) {
    // Install controller
    top.controllers.appendController(RTTicket.controller);

    // Install listeners
    RTTicket.prefs = new RTPrefsManager('extensions.rtticket.');
    RTTicket.prefs.register('rtUser', function(prefBranch, prefName) {
        RTTicket.prefs.rtUser = prefBranch.getCharPref(prefName);
    });
    RTTicket.prefs.register('rtDomain', function(prefBranch, prefName) {
        RTTicket.prefs.rtDomain = prefBranch.getCharPref(prefName);
    });
    RTTicket.prefs.register('rtWeb', function(prefBranch, prefName) {
        RTTicket.prefs.rtWeb = prefBranch.getCharPref(prefName).replace(/\/+$/, '');
    });

    // TODO: delayed_updateCommand
    // TODO: Add offline observer
};

RTTicket.teardown = function teardown(windowUnloadEvent) {
    // Uninstall listeners
    RTTicket.prefs.unregister('rtUser');
    RTTicket.prefs.unregister('rtDomain');
    RTTicket.prefs.unregister('rtWeb');
    RTTicket.prefs = null;

    // TODO: Remove offline observer

    // Uninstall controller
    top.controllers.removeController(RTTicket.controller);
};

/*********************************************************************
 * Commands
 ********************************************************************/

RTTicket.associate = function associate() {
    var mailWin = Components.classes['@mozilla.org/appshell/window-mediator;1']
                            .getService(Components.interfaces.nsIWindowMediator)
                            .getMostRecentWindow('');

    var selectedURIs = mailWin.GetSelectedMessages();
    RTTicket.log.assert(selectedURIs && selectedURIs.length,
                        'RTTicket.associate() called with no messages selected');
    // GetLoadedMsgFolder() in chrome://messenger/content/messageWindow.js
    // or chrome://messenger/content/msgMail3PaneWindow.js
    var msgSvc = messenger.messageServiceFromURI(selectedURIs[0]);
    var msgHdr = msgSvc.messageURIToMsgHdr(selectedURIs[0]);
    var current = RTTicket.getIdentityAndAccount(msgHdr);

    if (!current) {
        RTTicket.log.error('Unable to determine server');
        return;
    }
    window.openDialog('chrome://rtticket/content/associate.xul',
                      '_blank',
                      'dialog=no',
                      RTTicket, selectedURIs,
                        current.identity, current.account);
};

/*********************************************************************
 * Helper functions
 ********************************************************************/

RTTicket.getIdentityAndAccount = function getIdentityAndAccount(msgHdr) {
    var folder = msgHdr.folder;
    if (!(folder && folder.server)) {
        return null;
    }

    // accountManager in chrome://messenger/content/AccountManager.js
    var server = (folder.server.type) ? folder.server
                                      : accountManager.localFoldersServer;
    // getIdentityForServer() in chrome://messenger/content/mailCommands.js
    var identity = getIdentityForServer(server);
    if (identity == null) {
        // Probably a local (POP3) mailbox
        var hint = msgHdr.recipients && msgHdr.recipients.length ?
                        msgHdr.recipients[0] : msgHdr.author;
        identity = getBestIdentity(accountManager.allIdentities, hint);
    }
    RTTicket.log.debug('Using identity ' + identity.email);
    var account = accountManager.FindAccountForServer(server);
    return {
        identity: identity,
        account:  account
    };
};

RTTicket.interpolateVars = function interpolateVars(template, bindings) {
    return template.replace(/\\(.)|\$([A-Za-z_][A-Za-z0-9_]*)|\$(?:{([^}]+)})/g,
        function(expr, backslashed, varname, bracedVarname) {
            if (backslashed != null && backslashed.length) {
                switch (backslashed) {
                  case 'f': return '\f';
                  case 'r': return '\r';
                  case 'n': return '\n';
                  case 't': return '\t';
                  default:  return backslashed;
                }
            } else if (varname) {
                return bindings[varname];
            } else if (bracedVarname) {
                return bracedVarname;
            } else {
                return expr;
            }
        }
    );
};

// For each instance of a header in the message that is matched by
// headerNameRegex, foundCallback(headerName, headerValue, instanceCount) is
// called, where instanceCount=1 for the first header encountered,
// instanceCount=2 for the second time, etc.  If no header matches, then
// notFoundCallback() is called once.
RTTicket.actOnHeader = function getHeader(msgUri, headerNameRegex,
                                          foundCallback, notFoundCallback) {
    // We read the headers by pushing the message through
    // nsIMsgMessageService.CopyMessage(...).  Since
    // nsIMsgMessageService.CopyMessage(...) is asynchronous, we cannot simply
    // return the found header, but must use callbacks.
    var messenger = Components.classes['@mozilla.org/messenger;1']
                              .createInstance(Components.interfaces.nsIMessenger);
    var msgSvc = messenger.messageServiceFromURI(msgUri);

    var headerSeekingCopyListener = {
        inHeader: true,
        inDesiredHeader: false,
        headerCount: 0,
        leftovers: '',
        buf: '',
        header: null,
        inputStream: Components.classes['@mozilla.org/scriptableinputstream;1']
                               .createInstance(Components.interfaces.nsIScriptableInputStream),

        onStartRequest: function onStartRequest(request, context) {},

        onDataAvailable: function onDataAvailable(request, context, inputStream,
                                                  offset, count) {
            this.inputStream.init(inputStream);

            // Scan the message for the desired header
            while (this.inHeader
                   && (this.header == null || this.inDesiredHeader)) {
                try {
                    var read = this.inputStream.read(1024);
                } catch (eof) {
                    break;
                }
                this.buf = this.leftovers + read;
                this.leftovers = '';

                while (this.inHeader && this.buf.length > 0
                       && (this.header == null || this.inDesiredHeader)) {
                    // Parse out one line of header, terminated by the first
                    // of either CR or LF
                    var eol_r = this.buf.indexOf('\r');
                    var eol_n = this.buf.indexOf('\n');
                    var eol = (eol_r == -1)   ? eol_n :
                              (eol_n == -1)   ? eol_r :
                              (eol_r > eol_n) ? eol_n : eol_r;
                    if (eol == -1 || 1 + eol >= this.buf.length) {
                        // Either there is no CR or LF in this.buf,
                        // or one appears at the very end of this.buf.
                        // Read some more from the stream and try again.
                        this.leftovers = this.buf;
                        break;
                    }

                    var eolLen = ((this.buf[eol] == '\r' && this.buf[1+eol] == '\n') ||
                                  (this.buf[eol] == '\n' && this.buf[1+eol] == '\r')) ?
                                 2 : 1;
                    var line = this.buf.substr(0, eol);
                    this.buf = this.buf.substr(eol + eolLen);

                    var match;
                    if (this.inDesiredHeader
                          && (match = /^\s+(.*)/.exec(line))) {
                        this.header.value += ' ' + match[1];
                    } else {
                        if (this.header) {
                            if (foundCallback) {
                                foundCallback(this.header.name,
                                              this.header.value,
                                              ++this.headerCount);
                            }
                            this.header = null;
                        }

                        match = /^([A-Za-z0-9-]+):\s*(.*)/.exec(line);
                        this.inDesiredHeader = match
                                && headerNameRegex.test(match[1]);
                        if (this.inDesiredHeader) {
                            this.header = { name: match[1], value: match[2] };
                        }
                    }

                    // Empty line signifies end of headers
                    if (line == '\r\n') {
                        this.inHeader = this.inDesiredHeader = false;
                        return;
                    }
                }
            }
        },

        onStopRequest: function onStopRequest(request, context, status) {
            if (!this.headerCount && notFoundCallback) {
                notFoundCallback();
            }
        }
    };  // end headerSeekingCopyListener

    msgSvc.CopyMessage(
        msgUri,
        headerSeekingCopyListener,
        /* moveMessage= */      false,
        /* urlListener= */      null,
        /* messageWindow= */    null,
        /* newURI= */           {}
    );
};

/* vim: set shiftwidth=4 expandtab: */
