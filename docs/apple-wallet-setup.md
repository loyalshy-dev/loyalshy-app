# Apple Wallet Integration Setup

## Prerequisites

- **Apple Developer Program** membership ($99/year) — [developer.apple.com/programs](https://developer.apple.com/programs/)

## Step 1: Register a Pass Type ID

1. Go to [Apple Developer Portal](https://developer.apple.com/) → **Certificates, Identifiers & Profiles**
2. Navigate to **Identifiers → Pass Type IDs**
3. Click **+** to register a new Pass Type ID (e.g. `pass.com.loyalshy.loyalty`)
4. Save the identifier — this becomes your `APPLE_PASS_TYPE_IDENTIFIER`

## Step 2: Get Your Team Identifier

- Found in your Apple Developer account under **Membership Details**
- A 10-character alphanumeric string (e.g. `A1B2C3D4E5`)
- This becomes your `APPLE_TEAM_IDENTIFIER`

## Step 3: Create a Pass Type ID Certificate

1. In the Developer Portal → **Certificates** → click **+**
2. Select **Pass Type ID Certificate**
3. Choose the Pass Type ID you created in Step 1
4. Follow the wizard — it will ask you to upload a **Certificate Signing Request (CSR)**
   - Open **Keychain Access** on macOS → Certificate Assistant → Request a Certificate from a Certificate Authority
   - Save the CSR to disk
5. Upload the CSR and download the resulting `.cer` certificate
6. Double-click the `.cer` to install it in Keychain Access
7. In Keychain Access, find the certificate, right-click → **Export** as `.p12`
   - Set a password — this becomes your `APPLE_PASS_KEY_PASSPHRASE`

## Step 4: Download the Apple WWDR Certificate

1. Go to [Apple PKI](https://www.apple.com/certificateauthority/)
2. Download the **Worldwide Developer Relations - G4** certificate (`AppleWWDRCAG4.cer`)

## Step 5: Extract and Base64-Encode Certificates

### Extract cert and key from the `.p12` file

```bash
# Extract the signing certificate (public)
openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signerCert.pem

# Extract the private key
openssl pkcs12 -in pass.p12 -nocerts -out signerKey.pem
```

### Convert WWDR `.cer` to PEM

```bash
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

### Base64-encode for environment variables

```bash
base64 -i signerCert.pem | tr -d '\n'
base64 -i signerKey.pem | tr -d '\n'
base64 -i wwdr.pem | tr -d '\n'
```

## Step 6: Set Environment Variables

Add these to your `.env.local`:

```env
APPLE_TEAM_IDENTIFIER="YOUR_TEAM_ID"
APPLE_PASS_TYPE_IDENTIFIER="pass.com.loyalshy.loyalty"
APPLE_WWDR_CERTIFICATE="<base64-encoded wwdr.pem>"
APPLE_PASS_CERTIFICATE="<base64-encoded signerCert.pem>"
APPLE_PASS_KEY="<base64-encoded signerKey.pem>"
APPLE_PASS_KEY_PASSPHRASE="your-p12-export-password"
```

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `APPLE_TEAM_IDENTIFIER` | 10-char Team ID from Apple Developer Membership |
| `APPLE_PASS_TYPE_IDENTIFIER` | Pass Type ID registered in the portal (e.g. `pass.com.loyalshy.loyalty`) |
| `APPLE_WWDR_CERTIFICATE` | Base64-encoded Apple WWDR G4 intermediate certificate (PEM) |
| `APPLE_PASS_CERTIFICATE` | Base64-encoded Pass Type ID signing certificate (PEM) |
| `APPLE_PASS_KEY` | Base64-encoded private key for the signing certificate (PEM) |
| `APPLE_PASS_KEY_PASSPHRASE` | Passphrase set when exporting the `.p12` file |

## Verification

Once all 6 env vars are set, Apple Wallet pass generation will work automatically. The code is already fully implemented — no code changes needed.

### Key files

- `src/lib/wallet/apple/certificates.ts` — loads and caches certificates from env vars
- `src/lib/wallet/apple/constants.ts` — pass type ID, team ID, org name
- `src/lib/wallet/apple/generate-pass.ts` — pass generation using `passkit-generator`
- `src/app/api/wallet/apple/` — callback routes for pass updates and registration
