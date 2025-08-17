#  Cuddly Paws Server

## Created with Express JS + MongoDB + Firebase Auth

**Created by Mirul Moktadir Khan**

This is the backend server for my project *[Cuddly Paws - Pet Adoption & Donation Platform](https://cuddly-paws.web.app/)*. It handles secure user authentication with Firebase, donation campaigns, pet listings, and user role management. The API is built with Express.js and uses MongoDB as the database. Environment variables are used for secure credential handling, and CORS is configured to allow safe communication with the deployed frontend.

- Role-based authorization (admin/user)
- Secure endpoints protected with middleware
- CRUD operations for pets and donation campaigns
- Real-time donation progress and filtering
- Firebase token verification and admin check
- Dotenv for environment variable management

---

### 🔧 Packages Used

- [Node.js](https://nodejs.org/en)
- [Express.js](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin)
- [Dotenv](https://github.com/motdotla/dotenv)
- [Cors](https://www.npmjs.com/package/cors)

---

### 🔗 Live API Endpoint

> **Backend Live URL:** [https://cuddly-paws-server.vercel.app](https://cuddly-paws-server.vercel.app)

---

### 📁 Key Features

- 🔐 Firebase JWT verification and middleware
- 🔄 Full CRUD operations (Create, Read, Update, Delete)
- 👤 User role management (admin/user toggle)
- 🐶 Pet listings with image upload support
- 💝 Donation campaign creation and tracking
- 📦 REST API structure for clean separation of concerns

---
