Request Tracker Ticket Manager Extension For Mozilla Thunderbird
================================================================

Copyright 2006, 2014 The University of British Columbia and Derek Poon

Released under the Mozilla Public License, version 2.0.

This is an extension for the [Mozilla Thunderbird][1] mail client. It
facilitates correspondance and commenting on [Request Tracker][2] tickets.

The extension adds the following features:

- Ticket field when composing messages

  By putting a ticket number in the Ticket field of the message composition
  window, your outgoing message will be added as a comment on the ticket.

- Associate incoming messages with a ticket

  The extension adds a command (`Message → Associate`) to add the selected
  messages as comments on a ticket. You can add a toolbar button for the
  Associate command through `View → Toolbars → Customize…`.
  
- Delete tickets arising from spam

  When you hit the `Delete` button on messages that are marked as junk mail,
  the associated tickets are also deleted.

Compatibility
-------------

This extension is known to be compatible with Mozilla Thunderbird 1.x and 2.x.

Installation Instructions
-------------------------

1. Download the extension package to your desktop.
2. In Thunderbird menu, select `Tools → Extensions` (Thunderbird 1.x) or
   `Tools -> Add-Ons` (Thunderbird 2.x)
3. Click `Install`, select the downloaded package, click `Install Now`
4. Quit and relaunch Thunderbird
5. Delete the extension package from your desktop.

Configuration
-------------

The extension can be configured through Thunderbird's preferences screen or
through `Tools → Extensions → Request Tracker Ticket Manager → Options`.

 [1]: http://www.mozilla.org/thunderbird/
 [2]: http://www.bestpractical.com/rt/
