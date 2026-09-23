# App & Architectural Decisions: Vault Authenticator

---

## 👑 1. Store Concept
**Brand:** Crown & Brim Co.  
**Industry:** Premium High-End Apparel & Luxury Headwear  

Crown & Brim Co. produces limited-run, collectible luxury streetwear and headwear. Because each release is produced in strictly capped quantities, counterfeit products pose a high risk to brand reputation and secondary market authenticity. 

To solve this, every piece features a unique, cryptographically verifiable physical tag linked to a digital record on the merchant's store.

---

## 💎 2. Standout Theme Feature: "Crown Matrix"

To deliver a high-converting, interactive product experience on the storefront (`theme/`), we implemented the **Crown Matrix** widget directly on the Product Page:

* **Interactive "Notify My Size" Drawer:** Replaces traditional, static size charts with an interactive modal that guides collectors through finding their exact fitted cap size.
* **Unit Conversion & Sizing Engine:** Converts raw head circumference measurements from centimeters or inches into standard fitted cap sizes ranging from 7 up to 8 (including fractional step increments like 7 1/8, 7 1/4, 7 3/8, 7 1/2, 7 5/8, 7 3/4, etc.).
* **Dynamic Fit Preference Algorithm:** Refines the size calculation based on how the customer prefers their hat to sit:
- Snug Fit: Applies a -0.4 cm offset for a locked-down, precise feel.
- Balanced Fit: Standard baseline measurement calculation.
- Relaxed Fit: Applies a +0.4 cm offset for a looser, comfort-focused fit.
* **Customer UX:** Eliminates sizing guesswork and reduces return rates by translating real-world measurements into tailored fit recommendations right before checkout.

---


## 🛡️ 3. Embedded App Concept
**App Name:** Vault Authenticator  

Vault Authenticator provides merchants with a centralized command center to:
- **Mint Serial Artifacts:** Assign serial codes and cryptographic security hashes to individual product runs.
- **Track Telemetry & Security Alerts:** Monitor consumer scan attempts in real time and automatically flag suspicious or duplicate verifications.
- **Manage Tag Statuses:** Instant one-click revocation or reinstatement of compromised serial tags.
- **Dynamic Storefront Synchronization:** Automatically inject host tunnel endpoints into shop metafields to ensure seamless theme widget verification calls without manual API setup.

---

## 🏗️ 4. Key Architecture & Schema Decisions

### **Tech Stack**
- **Vite + React + Shopify Polaris:** Ensures a lightweight, high-density dashboard UI that perfectly matches Shopify's native design system.
- **Node.js:** Handles cryptographic hashing (`node:crypto`) and OAuth flow efficiently.
- **Drizzle ORM + MySQL:** Selected for strict type safety, relation handling, and rapid migration execution without heavy runtime overhead.

### **Database Schema (`drizzle/schema.ts`)**
1. **`products` Table:**
   - Stores store catalog references (`id`, `title`, `sku`).
2. **`serials` Table:**
   - Primary tracking model linking `productId` foreign keys to unique `serialNumber` values.
   - Includes `encryptionHash` (UUIDv4 or custom cryptographic secret) to prevent brute-forcing sequential serial codes.
   - Includes `status` (`ACTIVE`, `REVOKED`) and `batchRelease` (e.g., *Founder*, *VIP*, *Standard*).
3. **`verificationLogs` Table:**
   - Real-time audit trail capturing `serialId`, `ipAddress`, `statusReturned` (`VERIFIED`, `SUSPICIOUS`, `INVALID`), and timestamp data (`scannedAt`).

---

## ⚖️ 5. Technical Tradeoffs

1. **Relational Database (MySQL) vs. NoSQL:**
   - *Tradeoff:* MySQL requires explicit schema migrations and strict relational references.
   - *Rationale:* Financial and security verification requires strict integrity guarantees. A relational model prevents orphan serial numbers or unindexed logs.

2. **Drizzle ORM vs. Prisma:**
   - *Tradeoff:* Prisma offers an easier setup out of the box, but adds extra binary bundle weight.
   - *Rationale:* Drizzle is significantly lighter, highly performant, and gives closer SQL syntax control, ideal for embedded app response times.

3. **Client-Side AJAX Verification vs. Full Page Reload:**
   - *Tradeoff:* Requires JavaScript enabled in the customer's browser.
   - *Rationale:* Asynchronous fetch() requests inside the theme verification widget, Delivers an immediate, app-like modal response on the storefront without forcing a full page reload, maximizing user experience for mobile shoppers scanning product tags.

---

## 🚀 5. What I’d Improve with More Time

- **Geo-Location Threat Heatmap:** Integrate GeoIP tracking into `verificationLogs` to map illegal batch cloning hotspots geographically on a Polaris map visualization.
- **Storefront Customer Portal:** Allow authenticated buyers to claim verified items directly into a digital luxury vault inside their Shopify customer account.
