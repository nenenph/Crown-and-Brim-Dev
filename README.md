# Vault Authenticator & Crown & Brim Co. Theme

An embedded Shopify Admin app and custom storefront theme built for luxury brand product authentication and anti-counterfeiting tracking.

---

## 🛠️ Tech Stack

- **Storefront:** Shopify Liquid, CSS3, JavaScript ES6+
- **Embedded App Frontend:** Shopify Polaris, React, Vite[cite: 1]
- **Backend Framework:** Node.js, Remix / Express[cite: 1]
- **Database & ORM:** MySQL (Docker), Drizzle ORM[cite: 1]
- **Authentication:** Shopify OAuth & App Bridge API[cite: 1]

---

## 🚀 Quick Start & Setup Instructions

### 1. Prerequisites
- Node.js (`>= v18.x`)
- npm or pnpm
- **Docker** (for running the local MySQL database)
- Shopify Partner Account & Test Store
- Shopify CLI installed globally (`npm install -g @shopify/cli`)

### 2. Environment Configuration
Create a `.env` file in the root directory:

```env
PORT=3000
DATABASE_URL="mysql://root:password@localhost:3306/vault_engine"

# Managed during development via Shopify CLI
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SCOPES=read_products,write_products,read_metafields,write_metafields
```

###3. Installation & Database Setup (Docker)


```bash
# Install dependencies
npm install

# If opting to docker:
docker run --name vault-mysql -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=vault_engine -p 3306:3306 -d mysql:latest

# Push Drizzle schema to your MySQL database
npx drizzle-kit push:mysql

# (Optional) Seed initial data
npm run db:seed
```


###4. Running the Embedded App locally

```bash
# Start the local development server with Shopify CLI
shopify app dev
```

---

## 🎨 Shopify Theme Setup

1. Open your Shopify Partner Dashboard and navigate to **Online Store > Themes**.
2. Zip the contents of the `theme/` directory.
3. Upload the zip file under **Theme library > Add theme > Upload zip file**.
4. Click **Publish** to set Crown & Brim Co. as your active storefront.