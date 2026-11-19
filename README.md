# DENR Region IV-A RDAC Complaint Management and Tracking System

A centralized web-based Complaint Management and Tracking System developed for the Department of Environment and Natural Resources (DENR) Region IV-A (CALABARZON). The system is designed to streamline the recording, management, assignment, monitoring, investigation, and resolution of complaints received by the Regional Office and its corresponding field offices.

The platform provides a centralized environment where authorized personnel can manage complaint records, coordinate with concerned offices, monitor complaint progress, and maintain an organized record of actions and activities.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Objectives](#2-project-objectives)
3. [Key Features](#3-key-features)
4. [User Roles and Access Control](#4-user-roles-and-access-control)
5. [Complaint Management Workflow](#5-complaint-management-workflow)
6. [Organizational Coverage](#6-organizational-coverage)
7. [System Modules](#7-system-modules)
8. [Technology Stack](#8-technology-stack)
9. [System Architecture](#9-system-architecture)
10. [Database Information](#10-database-information)
11. [Installation and Setup](#11-installation-and-setup)
12. [Environment Configuration](#12-environment-configuration)
13. [Database Migration and Seeding](#13-database-migration-and-seeding)
14. [Running the Application](#14-running-the-application)
15. [Project Directory Structure](#15-project-directory-structure)
16. [Security Implementation](#16-security-implementation)
17. [Notifications and Email Integration](#17-notifications-and-email-integration)
18. [Audit Trail and Activity Monitoring](#18-audit-trail-and-activity-monitoring)
19. [System Requirements](#19-system-requirements)
20. [Development Guidelines](#20-development-guidelines)
21. [Troubleshooting](#21-troubleshooting)
22. [Future Enhancements](#22-future-enhancements)
23. [Contributing](#23-contributing)
24. [License](#24-license)

---

## 1. Project Overview

The DENR Region IV-A RDAC Complaint Management and Tracking System is a web-based application intended to improve the management and monitoring of complaints handled by the Regional and Field Offices of DENR Region IV-A.

Traditional complaint management processes may involve manually recording information, coordinating through different communication channels, and maintaining separate records. These processes can make it difficult to monitor complaint progress, identify responsible offices, and retrieve historical information.

This system addresses these challenges by providing a centralized platform for authorized DENR personnel.

Through the application, administrators can record complaints, conduct initial reviews, assign complaints to appropriate field offices, and monitor their progress until resolution or closure.

Field Office Users can access complaints assigned to their respective offices, update investigation progress, provide additional information, and submit findings for regional review.

The system also provides notifications, activity monitoring, and audit records to support accountability and transparency in complaint handling.

 Project Information

| Information | Description |
|---|---|
| Project Name | DENR Region IV-A RDAC Complaint Management and Tracking System |
| Organization | Department of Environment and Natural Resources |
| Regional Coverage | Region IV-A (CALABARZON) |
| System Type | Web-Based Complaint Management System |
| Primary Users | Administrators and Field Office Personnel |
| Backend Framework | Laravel 13 |
| Frontend Framework | React |
| Application Architecture | Inertia.js |
| Programming Language | PHP 8.3 |
| Database | MySQL |
| Styling Framework | Tailwind CSS |
| Development Environment | Laragon |

---

## 2. Project Objectives

The primary objective of the system is to provide an organized and centralized platform for handling complaints within DENR Region IV-A.

Specific objectives include:

- Centralize complaint records in a single database.
- Improve the recording and documentation of complaints.
- Streamline complaint assignment to the appropriate field offices.
- Allow authorized personnel to monitor complaint progress.
- Improve coordination between the Regional Office and Field Offices.
- Provide a structured complaint investigation and resolution process.
- Reduce reliance on fragmented manual tracking methods.
- Maintain historical records of complaint-related activities.
- Provide notifications regarding relevant complaint updates.
- Improve accountability through user activity monitoring and audit trails.
- Provide dashboards and reports to support administrative decision-making.

---

## 3. Key Features

 3.1 Dashboard and Analytics

Provides an overview of complaint records and operational activities.

Features include:

- Total complaint monitoring.
- Complaint status summaries.
- Complaint distribution by category.
- Complaint activity trends.
- Assigned complaint monitoring.
- Pending and ongoing complaint monitoring.
- Field Office workload overview.
- Recent complaint activities.

 3.2 Complaint Management

Allows authorized administrators to manage complaint records.

Features include:

- Record new complaints.
- Generate and manage complaint reference numbers.
- View complaint details.
- Edit complaint information.
- Categorize complaints.
- Assign complaints to appropriate offices.
- Update complaint statuses.
- Record complaint actions and investigation updates.
- Manage supporting documentation.
- Monitor complaint history.

 3.3 Complaint Assignment

Provides a structured assignment process between the Regional Office and Field Offices.

Features include:

- Assign complaints to the appropriate office.
- View assigned complaints.
- Monitor assignment status.
- Track responsible offices.
- Record assignment-related activities.

 3.4 Field Office Management

Allows administrators to manage participating DENR field offices.

Features include:

- Manage office records.
- Organize office information.
- Associate users with their respective offices.
- Monitor office assignments.
- Manage active and inactive office accounts.

 3.5 User Management

Allows administrators to manage authorized system accounts.

Features include:

- Create Field Office User accounts.
- Assign users to their corresponding offices.
- Manage user information.
- Activate and deactivate accounts.
- Control access based on user roles.
- Monitor account-related activities.

 3.6 Notifications

Provides notifications to inform authorized users about relevant system activities.

Features include:

- In-app notifications.
- Complaint-related notifications.
- Assignment notifications.
- Notification read/unread tracking.
- Email notification integration.

 3.7 Audit Trail

Maintains records of important activities performed within the system.

Features include:

- User activity monitoring.
- Complaint-related activity records.
- Tracking of important administrative actions.
- Recording of changes and updates.
- Historical activity reference.

 3.8 Reports and Monitoring

Supports the monitoring and review of complaint records.

The reporting module is intended to provide useful information for administrative monitoring, including complaint statuses, categories, assignments, and office-level activity.

---

## 4. User Roles and Access Control

The system implements role-based access control to ensure that users can only access the functions and information permitted by their assigned roles.

There are two primary user roles.

 4.1 Administrator

The Administrator has centralized management privileges.

Responsibilities:

- Manage complaint records.
- Conduct initial complaint reviews.
- Assign complaints to appropriate Field Offices.
- Monitor complaint progress.
- Manage Field Office records.
- Create and manage Field Office User accounts.
- Activate or deactivate accounts.
- Monitor system activities.
- Access administrative dashboards.
- Review audit trail records.
- Manage available system settings.
- Monitor complaint resolution and closure.

 4.2 Field Office User

The Field Office User is responsible for handling complaints assigned to their respective office.

Responsibilities:

- Access the Field Office dashboard.
- View complaints assigned to their office.
- Review complaint information.
- Conduct complaint investigations.
- Update investigation progress.
- Provide additional information when required.
- Record investigation findings.
- Submit complaint updates for regional review.
- Monitor notifications and assigned activities.

**Important:** Field Office Users are restricted to their authorized office records through role-based and office-based access controls.

 Account Registration Policy

The system does not provide public complainant registration or unrestricted self-registration.

Only the Administrator is authorized to create and manage Field Office User accounts.

---

## 5. Complaint Management Workflow

The system follows a structured complaint management workflow to ensure that complaints are properly recorded, reviewed, assigned, investigated, and resolved.

 Complaint Statuses

| Status | Description |
|---|---|
| Recorded | The complaint has been officially entered into the system. |
| For Initial Review | The complaint is awaiting initial assessment. |
| For Assignment | The complaint has completed the initial review and is awaiting assignment to the appropriate office. |
| Assigned | The complaint has been assigned to a responsible Field Office. |
| Under Investigation | The assigned office is conducting the necessary investigation. |
| For Additional Information | Additional information or supporting documents are required. |
| For RDAC Review | The investigation results or submitted information are awaiting Regional Office review. |
| Resolved | The complaint has reached a resolution. |
| Closed | The complaint has been officially closed. |

 Workflow Process

1. **Complaint Recording**

   The Administrator records the complaint and enters the necessary information into the system.

2. **Initial Review**

   The Administrator reviews the submitted complaint to determine the appropriate handling process.

3. **Office Assignment**

   The complaint is assigned to the appropriate DENR Field Office based on its location and nature.

4. **Investigation**

   The assigned Field Office User reviews the complaint and conducts the necessary investigation.

5. **Additional Information**

   If necessary, the responsible office provides additional information or supporting documentation.

6. **Regional Review**

   The complaint and investigation findings are submitted for RDAC review.

7. **Resolution**

   Once the necessary actions have been completed, the complaint is marked as resolved.

8. **Closure**

   The complaint is officially closed after the required handling and documentation processes are completed.

---

## 6. Organizational Coverage

The system is designed for DENR Region IV-A (CALABARZON), covering the following provinces:

- Cavite
- Laguna
- Batangas
- Rizal
- Quezon

 Provincial Environment and Natural Resources Offices (PENROs)

The system supports the management and organization of provincial offices, including:

- PENRO Cavite
- PENRO Laguna
- PENRO Batangas
- PENRO Rizal
- PENRO Quezon

 Community Environment and Natural Resources Offices (CENROs)

The system is designed to accommodate applicable CENRO offices within the region, including:

**Batangas**
- CENRO Lipa City
- CENRO Calaca

**Laguna**
- CENRO Sta. Cruz
- CENRO Pagsanjan

**Quezon**
- CENRO Calauag
- CENRO Catanauan
- CENRO Tayabas
- CENRO Real
- CENRO Pagbilao

The organizational structure allows complaints to be associated with the appropriate office for handling and monitoring.

*Note: The listed offices describe the intended organizational coverage. Actual office availability depends on the office records configured in the database.*

---

## 7. System Modules

The application is organized into the following functional modules:

| Module | Description |
|---|---|
| Authentication | Handles login, logout, and password recovery. |
| Dashboard | Displays complaint summaries and monitoring information. |
| Complaint Management | Handles complaint recording, viewing, editing, and status updates. |
| Complaint Assignment | Manages complaint distribution to appropriate offices. |
| Field Office Management | Maintains DENR office information. |
| User Management | Manages authorized system accounts and access. |
| Field Office Dashboard | Provides office-specific complaint monitoring. |
| Notifications | Handles in-app notifications and email integration. |
| Audit Trail | Records important system activities. |
| Reports | Provides complaint monitoring and reporting capabilities. |
| Email Settings | Supports email configuration and test email functionality. |

---

## 8. Technology Stack

The system uses modern web development technologies to provide a maintainable and responsive application.

 Backend

- **PHP 8.3** – Primary backend programming language.
- **Laravel 13** – Backend application framework.
- **MySQL** – Relational database management system.

 Frontend

- **React** – Component-based user interface development.
- **Inertia.js** – Connects Laravel backend routes and controllers with React pages.
- **Tailwind CSS** – Utility-first CSS framework for responsive styling.
- **JavaScript / TypeScript** – Frontend application logic.
- **Vite** – Frontend development server and asset bundler.

 Development Tools

- **Laragon** – Local development environment.
- **Composer** – PHP dependency management.
- **Node.js and npm** – JavaScript dependency management.
- **Git** – Version control.
- **GitHub** – Source code hosting and collaboration.

---

## 9. System Architecture

The application follows a Laravel and Inertia.js architecture with React as its frontend rendering layer.

 Application Flow

1. The user accesses the application through a web browser.
2. Laravel receives the incoming HTTP request.
3. Middleware checks authentication, user role, account status, and applicable office permissions.
4. The controller processes the request.
5. Laravel interacts with the MySQL database through its application models and database layer.
6. Inertia.js delivers the required page data to the React frontend.
7. React renders the user interface.
8. The application returns the requested page or action result to the user.

 Architecture Overview

```text
+-----------------------------+
|        Web Browser          |
|                             |
|       React Frontend        |
|       Tailwind CSS          |
+--------------+--------------+
               |
               v
+-----------------------------+
|          Inertia.js         |
|     Client-Server Bridge    |
+--------------+--------------+
               |
               v
+-----------------------------+
|        Laravel 13           |
|                             |
| Routes                      |
| Controllers                 |
| Middleware                  |
| Models                      |
| Business Logic              |
| Authentication              |
+--------------+--------------+
               |
               v
+-----------------------------+
|          MySQL              |
|                             |
| Complaint Records           |
| User Accounts               |
| Office Records              |
| Notifications                |
| Audit Records               |
+-----------------------------+
```

---

## 10. Database Information

The application uses MySQL as its relational database management system.

 Database Configuration

| Setting | Value |
|---|---|
| Database Name | `denr_rdac_iva` |
| Database Management System | MySQL |
| Database Connection | MySQL |
| Development Environment | Laragon |

 Database Responsibilities

The database stores information related to:

- User accounts and authentication.
- User roles and permissions.
- DENR office information.
- Complaint records.
- Complaint assignments.
- Complaint statuses and updates.
- Notifications.
- Audit trail records.
- System configuration and settings.

The actual database structure is maintained through Laravel migrations and the application's model relationships.

**Important:** Do not manually recreate database tables if migrations already exist. Always inspect the existing migrations before making structural database changes.

---

## 11. Installation and Setup

Follow these instructions to install and run the project on a local development machine.

 Prerequisites

Ensure that the following software is installed:

- PHP 8.3 or a compatible version required by the project.
- Composer.
- Node.js and npm.
- MySQL.
- Git.
- Laragon or another compatible local PHP development environment.

 Step 1: Clone the Repository

Open your terminal and navigate to your preferred project directory.

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
```

Navigate to the project folder:

```bash
cd YOUR-REPOSITORY
```

Replace the repository URL with the actual GitHub repository address.

 Step 2: Install PHP Dependencies

Run:

```bash
composer install
```

This installs the PHP packages defined in `composer.json`.

 Step 3: Install JavaScript Dependencies

Run:

```bash
npm install
```

This installs the frontend dependencies defined in `package.json`.

 Step 4: Create the Environment File

Copy the example environment file:

```bash
cp .env.example .env
```

For Windows Command Prompt:

```cmd
copy .env.example .env
```

 Step 5: Generate the Application Key

Run:

```bash
php artisan key:generate
```

This generates the Laravel application encryption key.

 Step 6: Create the MySQL Database

Open phpMyAdmin or your preferred MySQL management tool.

Create a database named:

```sql
CREATE DATABASE denr_rdac_iva;
```

Use the database name consistently in your `.env` configuration.

 Step 7: Configure the Database Connection

Update the database configuration in the `.env` file.

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=denr_rdac_iva
DB_USERNAME=root
DB_PASSWORD=
```

Adjust the database username, password, and port according to your local MySQL configuration.

 Step 8: Run Database Migrations

Execute:

```bash
php artisan migrate
```

This creates the database tables defined by the project's migration files.

If the project includes seeders, run them using the appropriate seeding command described in the next section.

 Step 9: Build Frontend Assets

For development:

```bash
npm run dev
```

For production:

```bash
npm run build
```

 Step 10: Start the Laravel Development Server

Open another terminal and run:

```bash
php artisan serve
```

The application will normally be available at:

```text
http://127.0.0.1:8000
```

Open the URL in your preferred web browser.

---

## 12. Environment Configuration

The `.env` file contains application-specific settings.

Common configuration variables include:

```env
APP_NAME="DENR RDAC Complaint Management System"
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=denr_rdac_iva
DB_USERNAME=root
DB_PASSWORD=

MAIL_MAILER=smtp
MAIL_HOST=
MAIL_PORT=
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_ENCRYPTION=
MAIL_FROM_ADDRESS=
MAIL_FROM_NAME="${APP_NAME}"
```

 Environment Configuration Notes

- `APP_ENV` identifies the current application environment.
- `APP_DEBUG` should be disabled in production.
- `APP_KEY` is used for Laravel encryption.
- `DB_DATABASE` specifies the MySQL database.
- `MAIL_HOST` and related settings configure email delivery.
- `APP_URL` should match the application's actual deployment address.

**Security Reminder:** Never upload your actual `.env` file, database credentials, email passwords, or application secrets to GitHub.

---

## 13. Database Migration and Seeding

Laravel migrations are used to manage database structure.

 Run Migrations

```bash
php artisan migrate
```

 Check Migration Status

```bash
php artisan migrate:status
```

 Run Database Seeders

```bash
php artisan db:seed
```

Only execute seeders after reviewing their contents and confirming that they are appropriate for your environment.

 Create a Migration

```bash
php artisan make:migration create_example_table
```

 Create a Model

```bash
php artisan make:model Example
```

 Create a Controller

```bash
php artisan make:controller ExampleController
```

**Warning:** Avoid using `php artisan migrate:fresh` on a database containing important records. This command drops existing tables before recreating them.

---

## 14. Running the Application

For local development, the application requires both the Laravel backend server and the Vite frontend development server.

 Terminal 1: Laravel

```bash
php artisan serve
```

 Terminal 2: Vite

```bash
npm run dev
```

Keep both terminals running while developing.

 Build for Production

```bash
npm run build
```

The production build generates optimized frontend assets.

---

## 15. Project Directory Structure

The following is a general Laravel project structure. Actual page and module filenames may differ depending on the current implementation.

```text
DENR-RDAC/
│
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Admin/
│   │   │   ├── Field/
│   │   │   └── Auth/
│   │   │
│   │   └── Middleware/
│   │
│   ├── Models/
│   └── Providers/
│
├── bootstrap/
│
├── config/
│
├── database/
│   ├── factories/
│   ├── migrations/
│   └── seeders/
│
├── public/
│
├── resources/
│   ├── css/
│   ├── js/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   │   ├── Admin/
│   │   │   └── Field/
│   │   └── types/
│   │
│   └── views/
│
├── routes/
│   ├── web.php
│   └── console.php
│
├── storage/
│
├── tests/
│
├── .env.example
├── .gitignore
├── artisan
├── composer.json
├── package.json
├── phpunit.xml
├── tsconfig.json
└── vite.config.ts
```

---

## 16. Security Implementation

The system incorporates security measures to protect complaint information, user accounts, and administrative operations.

 Authentication

- User authentication is required to access protected system pages.
- Users must log in using authorized credentials.
- Password recovery is supported.
- Session management is handled through Laravel authentication.

 Role-Based Access Control

- Separate access permissions for Administrators and Field Office Users.
- Protected administrative routes.
- Protected Field Office routes.
- Server-side role verification.
- Office-based access restrictions.

 Account Management

- Administrators control Field Office account creation.
- Inactive accounts are restricted from accessing protected functions.
- Field Office access requires an active account and an active associated office.

 Application Security

The application should maintain the following security practices:

- Password hashing.
- CSRF protection.
- Input validation.
- Output escaping.
- Protection against SQL injection through safe database operations.
- Session regeneration during authentication.
- Authorization checks on sensitive operations.
- Secure handling of uploaded documents.
- Protection of sensitive environment variables.

 Data Privacy

The system is intended to support responsible handling of complaint information in accordance with applicable data privacy requirements, including the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).

Access to complaint information should be limited to authorized personnel and legitimate operational purposes.

---

## 17. Notifications and Email Integration

The application includes notification functionality to help users stay informed about relevant system activities.

 In-App Notifications

The notification module supports:

- Displaying notifications.
- Tracking read and unread notifications.
- Marking notifications as read.
- Providing information about relevant complaint activities.

 Email Integration

The system includes email configuration and test email functionality.

Email settings are managed through the application's configuration and should use valid SMTP credentials.

Email delivery depends on the availability and correct configuration of the selected mail service.

---

## 18. Audit Trail and Activity Monitoring

The audit trail provides a historical record of important actions performed within the application.

Its purpose is to support accountability, monitoring, and traceability.

Activities that may be recorded include:

- User authentication activities.
- Complaint creation.
- Complaint updates.
- Complaint assignment.
- Status changes.
- Administrative operations.
- Other important system activities.

Audit records can help administrators review the history of complaint handling and identify which authorized users performed particular actions.

---

## 19. System Requirements

 Minimum Development Requirements

| Component | Requirement |
|---|---|
| Operating System | Windows, Linux, or macOS |
| PHP | 8.3 or compatible with Laravel 13 |
| Composer | Latest compatible version |
| Node.js | Version compatible with project dependencies |
| npm | Compatible with installed Node.js |
| Database | MySQL |
| Web Browser | Chrome, Firefox, Edge, or equivalent |
| Development Environment | Laragon or equivalent |

For exact package compatibility, refer to `composer.json`, `package.json`, and the project's lock files.

---

## 20. Development Guidelines

When modifying the application, follow these guidelines to maintain code quality and system stability.

 Backend Development

- Follow Laravel conventions.
- Keep business logic organized.
- Use appropriate controllers and models.
- Validate all incoming requests.
- Apply authorization checks before sensitive operations.
- Avoid duplicating application logic.
- Use migrations for database structure changes.

 Frontend Development

- Use reusable React components.
- Follow the existing Inertia.js architecture.
- Use Tailwind CSS for styling.
- Maintain consistent layouts and user interfaces.
- Implement responsive designs.
- Provide appropriate validation and feedback.

 Database Development

- Maintain database relationships.
- Use appropriate data types.
- Avoid unnecessary duplicate records.
- Preserve existing complaint records.
- Review foreign key dependencies before modifying tables.
- Never modify production data without an appropriate backup.

 Version Control

Use Git to manage project changes.

Check modified files:

```bash
git status
```

Stage changes:

```bash
git add .
```

Commit changes:

```bash
git commit -m "Describe your changes"
```

Push changes:

```bash
git push origin main
```

---

## 21. Troubleshooting

 Composer Dependency Errors

Run:

```bash
composer install
```

Check the installed PHP version:

```bash
php -v
```

 Frontend Dependency Errors

Run:

```bash
npm install
```

Then restart the development server:

```bash
npm run dev
```

 Database Connection Errors

Verify the following:

- MySQL service is running.
- Database exists.
- Database credentials are correct.
- Database port is correct.
- `.env` contains the correct configuration.

After modifying environment variables, clear the configuration cache:

```bash
php artisan config:clear
```

 Application Key Error

Generate a new key only when setting up a new environment without an existing application key:

```bash
php artisan key:generate
```

Do not regenerate the key on an existing production installation without understanding the impact on encrypted application data.

 Route Errors

Clear the route cache:

```bash
php artisan route:clear
```

List registered routes:

```bash
php artisan route:list
```

 Cache Issues

Clear the application cache:

```bash
php artisan optimize:clear
```

---

## 22. Future Enhancements

The following are potential enhancements that may further improve the system.

- Public complaint status tracking through a secure reference number verification process.
- Automated overdue complaint monitoring.
- Complaint deadline and response-time tracking.
- Advanced analytics and reporting.
- Exportable complaint reports in PDF and Excel formats.
- Improved investigation documentation.
- Enhanced complaint history and timeline visualization.
- More comprehensive office-level performance monitoring.
- Additional notification automation.
- Improved reporting filters and search functionality.
- Enhanced backup and recovery procedures.

These items are proposed enhancements and should not be considered implemented features unless they are present in the current application.

---

## 23. Contributing

Contributions and improvements are welcome.

When contributing to the project:

1. Review the existing application structure.
2. Create a separate branch for your changes.
3. Follow the established coding conventions.
4. Test your changes before committing.
5. Avoid modifying unrelated modules.
6. Provide meaningful commit messages.
7. Submit changes for review before merging into the main branch.

Example:

```bash
git checkout -b feature/new-module
```

After completing your changes:

```bash
git add .
git commit -m "Add new module"
git push origin feature/new-module
```

---

## 24. License

This project is developed for the DENR Region IV-A RDAC Complaint Management and Tracking System.

The project's source code, documentation, database structure, and related materials are intended for authorized project development, evaluation, and organizational use.

No open-source license is granted unless explicitly specified by the project owner or authorized organization.

---

## Acknowledgment

Developed for the Department of Environment and Natural Resources (DENR) Region IV-A (CALABARZON).

**Project:** RDAC Complaint Management and Tracking System

**Purpose:** To provide a centralized, organized, and efficient platform for complaint recording, assignment, investigation, monitoring, and resolution.

---

*For questions, technical concerns, or project-related information, please refer to the repository owner or authorized project maintainer.*
