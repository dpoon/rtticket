// Copyright 2006, 2014 The University of British Columbia and Derek Poon
// Released under the Mozilla Public License, v2.0.

pref("extensions.rtticket.debug", true);
pref("extensions.rtticket.rtUser", "$mailfrom");
pref("extensions.rtticket.rtDomain", "example.org");
pref("extensions.rtticket.rtWeb", "http://www.$rtdomain/rt");
pref("extensions.rtticket.compose.bcc", "rt-comment+$ticket@$rtdomain");
pref("extensions.rtticket.compose.replyTo", "rt-comment+$ticket@$rtdomain");
pref("extensions.rtticket.compose.errorsTo", "$mailfrom");
pref("extensions.rtticket.associate.resendTo", "rt-comment+$ticket@$rtdomain");
pref("extensions.rtticket.associate.overwriteOriginal", true);
pref("extensions.rtticket.associate.saveToSentMail", false);
