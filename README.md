# Puthuppadi Grama Panchayath - IT Stock Register & Asset Management Portal

A full-stack, responsive web application and two-way Google Sheets synchronization platform for managing IT infrastructure, hardware inventory, ticketing/service desk, consumable purchases, generator maintenance logs, IP address allocations, and official asset handover certificates for **Puthuppadi Grama Panchayath (PGP)**.

---

## 🌟 Key Features

1. **Executive Dashboard**:
   - Real-time KPI summary (Total Computers, Desktops, Laptops, Servers, Monitors, Printers, Peripherals, AMC Coverage).
   - Interactive breakdown of hardware across office sections (Main Office, Front Office, AE Office, NREGS, Ayurveda, etc.).

2. **Hardware Stock Register (Full CRUD)**:
   - **Computers & Servers**: Detailed specifications (Brand, Model, Serial No, Processor, RAM, Storage, OS, IP, Assigned Seat, Employee Name, AMC/Warranty Agency).
   - **Monitors & Displays**: Brand, Size/Resolution, Serial No, Seat allocations.
   - **Keyboards & Mice**: Hardware status and seat assignments.
   - **Printers & Scanners**: Model, Connectivity, and section deployment.
   - **Power & Network**: Online/Offline UPS systems, Inverter Batteries, Routers, Modems, Switches.

3. **Complaint & Ticketing Service Desk**:
   - Automated Ticket generation (`TKT-2026-xxx`).
   - Priority management (Critical, High, Medium, Low) and Keltron AMC CSP call tracking.
   - Replacement parts logging and printable official **Job Cards / Service Call Slips**.

4. **Asset Handover & Undertaking (RT Section)**:
   - Official hardware handover documentation with legal undertaking text in English and Malayalam.
   - One-click PDF / Print generator with official Panchayath stamp and signature blocks.

5. **Visual IP Address Matrix (192.168.0.x)**:
   - Visual grid of 254 IP addresses indicating allocated vs free IPs with fast search and assignment.

6. **Purchases & Mahindra Generator Register**:
   - Consumable logging (Toners, Cartridges, Drum units).
   - 25 KVA Mahindra Generator service and fuel maintenance tracker.

7. **Staff & Seat Code Directory**:
   - 34 Seat Codes mapped to staff designations and automatic VLOOKUP synchronization with Google Sheets.

8. **Mobile-Responsive & Theme Support**:
   - Off-canvas navigation drawer with touch-friendly controls.
   - Dark mode & Light mode switcher.

---

## 🔄 Two-Way Google Sheets Cloud Connector

- **Backend Sync Engine**: [google_apps_script.js](google_apps_script.js) deployed as a Google Apps Script Web App.
- **Formula Protection**: Built-in protection for formulas (`VLOOKUP`, status formulas) with automated row and column matching.
- **Live Sync**: Any updates made locally in the web app automatically push to Google Sheets, and data from Google Sheets can be pulled with one click.

---

## 🚀 Running Locally

### Prerequisites
- Python 3.8+
- Modern Web Browser

### Start Application
```bash
# Clone the repository
git clone https://github.com/shmrmhmdm/puduppadyitstock.git
cd puduppadyitstock

# Start the server
python server.py
```
Open your browser and navigate to `http://localhost:8080`.

---

## 📂 Project Architecture

```
├── index.html               # Main SPA Interface
├── styles.css               # Design System & Responsive Stylesheet
├── app.js                   # Client-Side Application Logic & State
├── server.py                # Python HTTP Server & REST API
├── stock_data.json          # Primary JSON Database
├── google_apps_script.js    # Cloud Connector for Google Sheets Web App
├── config.json              # Configuration & Google Apps Script Endpoint
└── README.md                # Project Documentation
```

---
*Developed for Puthuppadi Grama Panchayath IT Administration.*
