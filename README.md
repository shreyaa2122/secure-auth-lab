# SecureAuth – Authentication Monitoring and Security Analysis System

## Overview

SecureAuth is a web-based authentication and security monitoring system developed as part of an internship project at **Bharat Heavy Electricals Limited (BHEL)**. The project was designed to demonstrate the implementation of secure authentication practices, login activity monitoring, and fundamental cybersecurity concepts in a real-world web application.

The application provides a secure login mechanism, records authentication activities, monitors failed login attempts, and incorporates multiple security controls to improve the overall security posture of the system.

---

## Project Objectives

* Develop a secure user authentication system.
* Monitor and record login activities.
* Track successful and failed login attempts.
* Implement security-focused features to protect against common web threats.
* Demonstrate practical application of secure coding principles.
* Gain hands-on experience in full-stack web development and cybersecurity practices.

---

## Features

### User Authentication

* Secure login interface for users.
* Credential validation through backend authentication.
* Controlled access to protected resources.

### CAPTCHA Verification

* CAPTCHA integrated into the login page.
* Prevents automated login attempts.
* Reduces the risk of brute-force and bot-based attacks.

### Login Activity Monitoring

* Records every authentication attempt.
* Tracks successful and failed login requests.
* Maintains a detailed audit trail of user activity.

### Failed Login Tracking

* Detects invalid login attempts.
* Stores authentication status for security analysis.
* Helps identify suspicious behavior and attack patterns.

### IP Address Logging

* Records client IP addresses during login attempts.
* Supports monitoring and investigation of suspicious activities.

### Security Logging

* Maintains authentication logs with timestamps.
* Provides data for security auditing and analysis.

### HTTPS Deployment

* Deployed using secure HTTPS communication.
* Protects sensitive information during transmission.
* Prevents interception of user credentials.

### Security Headers Implementation

The application implements several HTTP security headers to enhance browser-level security, including:

* Strict-Transport-Security (HSTS)
* X-Frame-Options
* X-Content-Type-Options
* X-DNS-Prefetch-Control
* X-Download-Options
* X-Permitted-Cross-Domain-Policies

These headers help mitigate common web application attacks such as clickjacking and content-type spoofing.

---

## Technology Stack

### Frontend

* HTML5
* CSS3
* JavaScript

### Backend

* Node.js
* Express.js

### Database

* SQLite
* better-sqlite3

### Deployment

* Render

---

## System Workflow

1. User enters login credentials.
2. CAPTCHA verification is completed.
3. Credentials are sent to the backend server.
4. Backend validates credentials against the database.
5. Authentication result is generated.
6. Login activity is recorded.
7. Successful users are redirected to the dashboard.
8. Failed attempts are logged for monitoring purposes.

---

## Security Features

* User Authentication
* CAPTCHA Verification
* Login Attempt Monitoring
* Failed Login Detection
* IP Address Tracking
* Security Event Logging
* HTTPS Secure Communication
* Security Header Protection
* Secure Coding Practices

---

## Database Design

The project uses SQLite to store authentication-related information.

The database maintains:

* User account information
* Authentication records
* Login activity logs
* Security monitoring data

---

## Learning Outcomes

Through this project, practical experience was gained in:

* Full-stack web application development
* Authentication system design
* Secure coding practices
* Database integration
* Security monitoring and logging
* HTTPS deployment
* Cybersecurity fundamentals
* OWASP security concepts
* Web application security testing

---

## Future Enhancements

Planned improvements include:

* Password hashing using bcrypt
* Email verification through OTP
* Multi-Factor Authentication (MFA)
* Account lockout after multiple failed login attempts
* Advanced security analytics dashboard
* Role-Based Access Control (RBAC)
* Automated attack detection and alerting
* PostgreSQL integration for scalability
* Enhanced OWASP security compliance

---

## Internship Information

This project was developed during an internship at **Bharat Heavy Electricals Limited (BHEL)** under the guidance of **Mr. Suman Mondal**. The internship provided valuable exposure to software development practices, authentication mechanisms, database management, and cybersecurity concepts, enabling the practical implementation of secure web application development principles.


## Conclusion

SecureAuth demonstrates the implementation of a secure authentication system combined with security monitoring and logging capabilities. The project highlights the importance of authentication security, activity monitoring, and secure deployment practices in modern web applications while providing a strong foundation for future cybersecurity enhancements.
