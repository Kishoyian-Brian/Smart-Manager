# Smart City Waste Management System

A comprehensive web-based waste management platform for municipal governments, connecting citizens, administrators, and waste collectors in a unified digital ecosystem.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [User Roles](#user-roles)
- [System Flow](#system-flow)
- [Installation & Setup](#installation--setup)
- [File Structure](#file-structure)
- [Authentication & Security](#authentication--security)
- [Data Storage](#data-storage)
- [Technologies Used](#technologies-used)
- [Usage Guide](#usage-guide)
- [Default Credentials](#default-credentials)

## 🎯 Overview

The Smart City Waste Management System is an IoT-enabled platform designed to streamline waste collection operations in urban areas. It enables citizens to report waste issues, administrators to manage and approve reports, and collectors to efficiently complete collection tasks with route optimization.

**Key Benefits:**
- Real-time waste reporting and tracking
- Optimized collection routes for efficiency
- Heat map visualization of collection hotspots
- Role-based access control
- Responsive design for mobile and desktop
- No external API keys required for core functionality

## ✨ Features

### For Citizens
- **Waste Reporting**: Submit reports with location, waste type, and fill level
- **Location Services**: Use GPS or manual address entry
- **Report Tracking**: View submission confirmation

### For Administrators
- **Dashboard**: Overview of system statistics and recent activity
- **Pending Reports Management**: Review, approve, or reject waste reports
- **All Reports View**: Complete history with filtering and search
- **Heat Map**: Visual representation of collection hotspots in Tharaka Nithi County
- **Collector Management**: Add and manage collector accounts
- **Drive Scheduling**: Schedule collection drives
- **Smart Bins Monitoring**: Track bin status and locations

### For Collectors
- **Assigned Reports**: View approved waste collection assignments
- **Interactive Map**: See collection locations on an interactive map
- **Route Optimization**: Calculate efficient collection routes
- **Collection Tracking**: Mark reports as collected upon completion
- **Google Maps Integration**: Get turn-by-turn directions to collection sites

## 👥 User Roles

The system supports three distinct user roles:

### 1. **Public/Citizen** (No login required)
- Can submit waste reports
- Access public information pages

### 2. **Administrator** (`admin` role)
- Full system access
- Manage all reports (approve/reject)
- View analytics and heat maps
- Manage collector accounts
- Schedule collection drives

### 3. **Collector** (`collector` role)
- View assigned reports
- Access collection map
- Calculate optimized routes
- Mark reports as collected

## 🔄 System Flow

The waste management process follows a three-stage workflow:

```
1. REPORT (Citizen)
   ↓
   Status: PENDING
   ↓
2. REVIEW & APPROVE (Admin)
   ↓
   Status: APPROVED
   ↓
3. COLLECT (Collector)
   ↓
   Status: COLLECTED
```

### Detailed Flow:

1. **Report Submission**
   - Citizen fills out the waste report form
   - Provides location (GPS or manual), waste type, fill level
   - Report is saved with status: `pending`
   - Unique report ID is generated

2. **Admin Review**
   - Admin logs in and views pending reports
   - Can approve (moves to `approved`) or reject (removes from system)
   - Approved reports become visible to collectors

3. **Collection**
   - Collector views assigned (`approved`) reports
   - Uses map to see locations
   - Calculates optimized route
   - Visits location and marks as `collected`
   - Report is archived

## 🚀 Installation & Setup

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (optional, for development)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kishoyian-Brian/WasteManagement.git
   cd WasteManagement
   ```

2. **Open in browser**
   - Option 1: Open `index.html` directly in your browser
   - Option 2: Use a local server:
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Node.js (with http-server)
     npx http-server
     
     # PHP
     php -S localhost:8000
     ```
   - Navigate to `http://localhost:8000`

3. **Access the system**
   - Public pages: `index.html`, `report.html`
   - Admin portal: `admin/index.html` (requires login)
   - Collector portal: `collector/index.html` (requires login)

### No Build Process Required
This is a pure HTML/CSS/JavaScript application with no build step needed. All dependencies are loaded via CDN.

## 📁 File Structure

```
WasteManagement/
│
├── index.html              # Public homepage
├── report.html             # Waste report submission form
├── login.html              # Staff login page
├── style.css               # Main stylesheet
│
├── admin/
│   ├── index.html          # Admin dashboard
│   └── admin.js            # Admin page logic
│
├── collector/
│   ├── index.html          # Collector dashboard
│   └── collector.js        # Collector page logic
│
└── js/
    ├── data.js             # Shared data layer & authentication
    └── report.js           # Report form logic (if needed)
```

## 🔐 Authentication & Security

### Session Management
- Uses `sessionStorage` for user sessions (cleared on browser close)
- Session includes: username, role, login timestamp
- Protected routes check authentication before rendering content

### Route Protection
- **Admin routes** (`admin/index.html`): Requires `admin` role
- **Collector routes** (`collector/index.html`): Requires `collector` role
- Unauthorized access redirects to login page
- Session expires when browser closes

### Authentication Flow
1. User submits credentials on `login.html`
2. System validates against stored users
3. On success, session is stored in `sessionStorage`
4. User is redirected to appropriate dashboard
5. Protected pages check session on load
6. Logout clears session and redirects to login

## 💾 Data Storage

### localStorage (Persistent)
- **Waste Reports**: All waste reports with status history
- **Users**: Admin and collector accounts
- Data persists across browser sessions

### sessionStorage (Temporary)
- **Active Session**: Current logged-in user information
- Cleared when browser closes

### Data Structure

**Report Object:**
```javascript
{
  id: "r1234567890",
  name: "John Doe",
  location: "Main Street, Tharaka Nithi",
  wasteType: "plastic",
  fillLevel: "high",
  status: "pending|approved|collected",
  createdAt: "2026-02-17T10:30:00.000Z",
  approvedAt: null,
  collectedAt: null,
  lat: -0.1234,
  lng: 37.5678
}
```

**User Object:**
```javascript
{
  username: "admin",
  password: "admin123",
  role: "admin|collector"
}
```

## 🛠 Technologies Used

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with Flexbox/Grid, responsive design
- **Vanilla JavaScript**: No frameworks, pure ES5+ JavaScript

### Libraries & APIs
- **Leaflet.js**: Interactive maps (open-source, no API key)
- **Nominatim (OpenStreetMap)**: Geocoding (address ↔ coordinates)
- **Google Maps**: Turn-by-turn directions links

### Storage
- **localStorage**: Persistent data storage
- **sessionStorage**: Session management

## 📖 Usage Guide

### For Citizens

1. **Submit a Report**
   - Navigate to "Report Waste" page
   - Fill in your name
   - Enter location (or use "Use my location")
   - Select waste type and fill level
   - Submit the form

### For Administrators

1. **Login**
   - Go to "Login" page
   - Enter admin credentials
   - Access admin dashboard

2. **Review Pending Reports**
   - Click "Pending Reports" in sidebar
   - Review each report
   - Approve or reject individually or in bulk

3. **View Heat Map**
   - Click "Heat Map" in sidebar
   - See collection hotspots (red zones = high activity)
   - Review management insights

4. **Manage Collectors**
   - Click "Collectors" in sidebar
   - Add new collector accounts
   - Remove collectors if needed

5. **View All Reports**
   - Click "All Reports" in sidebar
   - Filter by status, search, sort
   - View detailed information

### For Collectors

1. **Login**
   - Go to "Login" page
   - Enter collector credentials
   - Access collector dashboard

2. **View Assigned Reports**
   - See all approved reports assigned to you
   - Filter and search reports

3. **Use Map View**
   - Click "View on Map" button
   - See all collection locations
   - Click "Calculate Route" for optimized route

4. **Complete Collection**
   - Visit the location
   - Click "Mark as Collected" on the report
   - Report status updates to `collected`

## 🔑 Default Credentials

**Demo Accounts** (seeded automatically):

- **Admin**
  - Username: `admin`
  - Password: `admin123`
  - Role: Administrator

- **Collector**
  - Username: `collector`
  - Password: `collector123`
  - Role: Collector

⚠️ **Important**: Change these credentials in production! Edit `js/data.js` to modify default users.

## 🗺️ Map Features

### Heat Map (Admin)
- Displays collection hotspots in Tharaka Nithi County
- Red zones indicate high collection activity
- Helps identify areas needing more frequent collection
- Generates management insights automatically

### Collection Map (Collector)
- Shows all assigned collection locations
- Custom markers with report details
- Route optimization using nearest-neighbor algorithm
- Google Maps integration for navigation

## 📱 Responsive Design

The system is fully responsive and works on:
- **Desktop**: Full-featured experience
- **Tablet**: Optimized layout with touch-friendly controls
- **Mobile**: Streamlined interface, horizontal scrolling for tables

## 🔄 Status Workflow

Reports progress through three statuses:

1. **PENDING** → Newly submitted, awaiting admin review
2. **APPROVED** → Admin approved, assigned to collector
3. **COLLECTED** → Collector completed the task

## 🚧 Future Enhancements

Potential improvements:
- Email notifications
- SMS alerts for urgent reports
- Mobile app version
- Real-time GPS tracking for collectors
- Analytics dashboard with charts
- Export reports to PDF/CSV
- Multi-language support
- Integration with IoT sensors

## 📝 License

This project is developed for Rictei Municipal Government as part of the Smart City initiative.

## 👨‍💻 Development

### Adding New Features
1. Modify relevant HTML files for UI changes
2. Update `admin/admin.js` or `collector/collector.js` for logic
3. Extend `js/data.js` for new data operations
4. Update `style.css` for styling

### Testing
- Test in multiple browsers
- Verify responsive design on different screen sizes
- Test authentication flow
- Verify route protection

## 📞 Support

For issues or questions, please contact the development team or create an issue in the repository.

---

**Built with ❤️ for Smart City Waste Management**

© 2026 Rictei Municipal Government
