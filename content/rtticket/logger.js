// Copyright 2006, 2014 The University of British Columbia and Derek Poon
// Released under the Mozilla Public License, v2.0.

function RTTicketLogger() {
    // RTPrefsManager is defined in prefsmgr.js
    var prefsMgr = new RTPrefsManager('extensions.rtticket.');
    var me = this;
    prefsMgr.register('debug', function(prefBranch, prefName) {
        try {
            var enabled = prefBranch.getBoolPref(prefName);
            me.setDebugEnabled(enabled);
        } catch (ex) {}
    });
}

RTTicketLogger.prototype = {
    tag: '[rtticket] ',
    consoleSvc: null,
    debugEnabled: false,
    consoleSvc: Components.classes["@mozilla.org/consoleservice;1"]
                          .getService(Components.interfaces.nsIConsoleService),

    setDebugEnabled: function(b) {
        this.debugEnabled = b;
    },

    debug: function(str) {
        if (this.debugEnabled) {
            var logMessage = this.tag + str;
            return this.consoleSvc.logStringMessage(logMessage);
        }
    },

    error: function(str) {
        var logMessage = this.tag + str;
        var scriptErr = Components.classes['@mozilla.org/scripterror;1']
                                  .createInstance(Components.interfaces.nsIScriptError);
        scriptErr.init(logMessage,
                       /* sourceName= */    null,
                       /* sourceLine= */    null,
                       /* lineNumber= */    0,
                       /* columnNumber= */  0,
                       /* flags= */         scriptErr.errorFlag,
                       /* category= */      'javascript');
        this.consoleSvc.logMessage(scriptErr);
    },

    assert: function(cond, str) {
        if (!cond) {
            var err = new Error(str);
            err.name = 'AssertionFailure';
            throw err;
        }
    }
}

/* vim: set shiftwidth=4 expandtab: */
