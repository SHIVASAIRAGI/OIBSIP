
# DayFlow – Personal Task Manager with Authentication

## Project Overview
DayFlow is a responsive personal task management application with a client-side registration and login system. Users can create an account, sign in and manage their own tasks.

## Features

### Authentication
- User registration and login
- Username and email validation
- Password validation (minimum 8 characters and at least one number)
- SHA-256 password hashing demonstration
- Duplicate account detection
- Session-based login state
- Logout functionality

### Task Management
- Add, edit and delete tasks
- Mark tasks as completed
- All, Active and Completed filters
- High, Medium and Low priority
- Due dates and due times
- Browser notifications
- Repeating alarm until stopped
- Separate task lists for each account
- Progress statistics
- Local storage

## Technologies Used
- HTML5
- CSS3
- JavaScript
- Web Storage API
- Web Crypto API
- Browser Notification API
- Web Audio API

## How to Run
1. Open the project in Visual Studio Code.
2. Install the Live Server extension.
3. Right-click `index.html`.
4. Select Open with Live Server.
5. Register a new account.
6. Log in and start managing your tasks.

## Important Security Note
This is an educational front-end project. SHA-256 hashing in the browser and localStorage are not suitable for production authentication. A real application should use a backend, a password-hashing algorithm such as bcrypt or Argon2, HTTPS and server-managed sessions.

## Reminder Note
Task reminders work while the application is open. Browser notifications require permission. Closing the browser or shutting down the computer can prevent reminders from running.

## Internship
Oasis Infobyte Web Development Internship – Task 3 and integrated Task 4 demonstration.
