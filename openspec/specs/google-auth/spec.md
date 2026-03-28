# Capability: google-auth

## Purpose

Handles Google OAuth 2.0 authentication for the plugin, including credential configuration, the authorization flow, token refresh, and disconnection.

## Requirements

### Requirement: User configures Google OAuth credentials
The plugin settings tab SHALL provide input fields for the user to enter their Google Cloud OAuth 2.0 Client ID and Client Secret. The Client Secret SHALL be stored using `app.secretStorage`. The Client ID SHALL be stored via `plugin.saveData()`.

#### Scenario: User enters credentials for the first time
- **WHEN** the user opens plugin settings and enters a Client ID and Client Secret
- **THEN** the Client ID is saved to plugin data and the Client Secret is saved to `app.secretStorage`

#### Scenario: SecretStorage is unavailable
- **WHEN** the user opens plugin settings on a system where `app.secretStorage` is unavailable
- **THEN** the plugin displays a warning notice and disables the Client Secret input field

---

### Requirement: Plugin initiates OAuth authorization flow
When the user triggers authentication, the plugin SHALL open the Google OAuth consent URL in the system browser and start a temporary local HTTP server on a random port (bound to 0) to receive the authorization code via loopback redirect.

#### Scenario: Successful authorization
- **WHEN** the user clicks "Connect Google Account" and completes the consent screen in their browser
- **THEN** the plugin receives the authorization code via the loopback redirect, exchanges it for access and refresh tokens, stores both via `app.secretStorage`, and displays a success notice

#### Scenario: User cancels or closes the browser
- **WHEN** the user dismisses the OAuth consent screen without completing authorization
- **THEN** the plugin times out the local server after 5 minutes, displays an error notice, and leaves stored credentials unchanged

#### Scenario: Authorization code exchange fails
- **WHEN** the authorization code exchange request to Google returns an error
- **THEN** the plugin displays an error notice with the reason and does not store any tokens

---

### Requirement: Plugin refreshes expired access tokens
The plugin SHALL automatically refresh the access token using the stored refresh token before making any Google Tasks API call when the access token is expired or absent.

#### Scenario: Access token is expired
- **WHEN** the plugin prepares a Google Tasks API call and the stored access token is expired
- **THEN** the plugin requests a new access token using the refresh token, stores the new access token via `app.secretStorage`, and proceeds with the API call

#### Scenario: Refresh token is invalid or revoked
- **WHEN** the token refresh request fails with an invalid_grant error
- **THEN** the plugin clears all stored tokens, displays a notice asking the user to re-authenticate, and aborts the current operation

---

### Requirement: User can disconnect their Google account
The plugin settings tab SHALL provide a "Disconnect" action that clears all stored OAuth tokens.

#### Scenario: User disconnects
- **WHEN** the user clicks "Disconnect Google Account" in plugin settings
- **THEN** all OAuth tokens are deleted from `app.secretStorage` and the settings UI reflects the disconnected state
