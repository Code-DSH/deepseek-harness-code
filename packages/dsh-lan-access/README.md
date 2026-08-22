# dsh-lan-access

Official-format, client-only Web plugin for the desktop app's General settings.
It exposes an explicit LAN enable/disable and optional password control. The
desktop bridge supplies only redacted state; passwords are never returned to
the Web UI.

The link is intended for another device on the same reachable LAN. If the
copied link cannot be opened, allow the app's displayed port through the host
firewall and check that the network does not enable guest/client isolation.
This plugin does not provide Internet exposure or TLS.
