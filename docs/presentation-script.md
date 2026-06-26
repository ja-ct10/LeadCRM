# PPT Presentation Script - Non-Functional Requirements

## Slide 1
Title - Non-Functional Requirements
Subtitle - Operational, Performance, Security, and Cultural Guidelines

Script - 
Welcome everyone. Today we are going to review the non-functional requirements for our system. These are the rules that ensure our system is reliable, fast, secure, and legally compliant. We will go through four main topics in order. Operational Requirements, Performance Requirements, Security Requirements, and Cultural and Political Requirements.

---

## Slide 2
Title - Operational Requirements (Part 1)
Bullets - 
* Guarantees smooth access for 16 concurrent users while recording highly detailed system errors to help the tech team resolve issues quickly.
* Enhances the user experience with helpful screen tooltips, full keyboard navigation, and pop-up confirmations to safely prevent accidental data loss.
* Features a highly responsive interface that works perfectly across all major web browsers and gracefully adapts to mobile and desktop screens.

Script - 
Let us start with Operational Requirements. Our system easily supports 16 users at the exact same time without slowing down. To prevent accidental data loss, the system will always pop up and ask for your confirmation before deleting anything. We have built-in tooltips to help users understand what each form field does, and you can comfortably navigate the entire system using just a keyboard. Our error logging is highly detailed to help our tech team fix issues fast. Lastly, the app works perfectly across all major web browsers and gracefully adjusts to fit any screen size from a mobile phone to a large desktop monitor.

---

## Slide 3
Title - Operational Requirements (Part 2)
Bullets - 
* Empowers users to easily export important lead data to CSV, JSON, and XLSX formats while safely maintaining an uneditable audit trail of all changes.
* Allows System Administrators to quickly configure custom lead status types directly in the interface without requiring any developer code changes.
* Securely integrates with third-party platforms via API keys to handle automated email campaigns, SMS gateway alerts, and PayMongo financial transactions.

Script - 
Continuing with operations, users can easily extract and export their records in multiple popular spreadsheet formats. Behind the scenes, we maintain a secure, read-only audit trail so we always know exactly what changes were made to a record. System administrators have the ultimate power to create and edit custom lead statuses directly from the dashboard, no coding required. Furthermore, we are fully and securely integrated with an email provider, an SMS gateway, and PayMongo to safely handle all of your communications and financial payments. 

---

## Slide 4
Title - Operational Requirements (Part 3)
Bullets - 
* Ensures high system reliability with daily automated 30 day backups, 70 percent automatic testing coverage, and seamless background software updates.
* Optimizes the user workflow by keeping exact search queries intact between pages and immediately double checking all form inputs before data reaches the server.
* Displays a clearly visible, real time connection status indicator so users always know if they are actively connected to the internet.

Script - 
To keep everything running securely, the system backs up your data daily and stores it for 30 full days. We can roll out new platform updates seamlessly without having to take the system offline. We ensure top quality by mathematically testing 70 percent of our core code. Users will always see a helpful icon showing if they are correctly connected to the internet. Also, when you search or filter large sets of data, your choices stay locked in place as you move between pages. We actively check all form inputs directly on your device before sending them to the server to make the experience extremely fast.

---

## Slide 5
Title - Operational Requirements (Part 4)
Bullets - 
* Provides clear visual feedback using loading spinners for slow tasks, live progress indicators for bulk messaging, and thorough row by row validation during CSV imports.
* Protects active work by remembering your dashboard layout preferences and securely saving draft lead entries every 30 seconds while users type.
* Strictly enforces data accuracy by actively preventing duplicate entries, validating leads against business rules, and delivering highly specific error messages.
* Clearly displays the exact synchronization status for any offline actions waiting in the offline queue.

Script - 
Finally for Operational Requirements, we make sure the system feels incredibly responsive. It shows a loading spinner if a tricky task takes more than a second, and a live progress bar when sending bulk emails. When you customize your dashboard widgets, it perfectly remembers your layout for next time. Our error messages are designed to tell you exactly how to fix the problem. Leads validate strictly against business rules before advancing in the pipeline, and everything you type saves automatically every 30 seconds to prevent lost work. We completely stop duplicate leads from being created, give you clear feedback during batch CSV imports, and safely let you know when your offline work is syncing back to the cloud.

---

## Slide 6
Title - Performance Requirements
Bullets - 
* Guarantees rapid two second response times for saving, updating, and displaying database records, even with 50 concurrent users constantly active.
* Immediately redirects users upon login within five seconds and gathers all complex dashboard data fully within a ten second window.
* Comfortably scales to support at least 1,000 individual users per client organization while ensuring full system recovery and draft saving within 30 seconds after any unexpected crash.

Script - 
Now let us talk about Performance. Maximum speed is critical for productivity. The system handles saving, updating, and displaying database records in 2 seconds or less, even with 50 people heavily using it at once. After logging in, you will be redirected in just 5 seconds, and your entire complex dashboard will be fully loaded within 10 seconds. We built this specific architecture to scale up aggressively, supporting up to 1,000 active users per company. If something unexpected happens like a server crash, the system recovers completely within 30 seconds and securely saves whatever you were working on as a draft.

---

## Slide 7
Title - Security Requirements (Part 1)
Bullets - 
* Strictly enforces Role Based Access Control to safely filter dashboard data, ensuring users only see records specific to their assigned role and organization.
* Acts as a strict safeguard by requiring explicit user confirmation before executing permanent deletions, while automatically saving drafts during rare system failures.
* Secures user accounts by forcing the creation of complex minimum 8 character passwords that utilize both mixed case letters and numbers.

Script - 
Moving on to Security Requirements. Protecting your company data is a massive priority. Your access is heavily restricted based on your exact role and organization, so you only see the records you are legally supposed to see on your dashboard. We stop accidental data loss by automatically saving drafts during system crashes, and we will always ask you to click a confirm button before deleting anything permanently. To protect your user account from being guessed, we force the creation of strong passwords that are at least 8 characters long, using both mixed letters and numbers.

---

## Slide 8
Title - Security Requirements (Part 2)
Bullets - 
* Forces all users to update their personal passwords every 90 days while actively blocking them from simply reusing their previously used passwords.
* Permanently stops hacking attempts by fully locking out accounts for 5 minutes after witnessing 5 consecutive failed login attempts.
* Mathematically scrambles raw passwords with a strong hashing algorithm before they reach the database and visually masks them with dots while typing on the screen.

Script - 
To keep system access fully secure over a long period of time, the platform requires everyone to change their password every 90 days, and you cannot cheat by reusing an old password. If an unauthorized person types the wrong password five times, the account forcibly locks down for five minutes to block software hackers. We never actually store your raw passwords we use a strong mathematical hashing algorithm so they are impossible to read even if the database is illegally accessed. Also, out in the real world, the password text field safely hides the text as you type it.

---

## Slide 9
Title - Cultural and Political Requirements (Part 1)
Bullets - 
* Securely complies with the mandatory Philippine Data Privacy Act of 2012 while fully supporting international GDPR regulations for global customers.
* Provides a flexible English based interface that defaults to the Philippine Peso and Manila time, while allowing users to easily select global currencies and UTC timezones.
* Automatically formats input fields to recognize Philippine phone number conventions while gracefully validating mobile numbers from other international countries.

Script - 
Finally, our Cultural and Political Requirements. Our system is fully legally compliant with both the Philippine Data Privacy Act and the international GDPR rules. We purposely built the entire platform in English. By default, it cleanly manages money using the Philippine Peso and operates on Manila time, but customers can easily shift these defaults to support their own global currencies and UTC timezones. We also specifically format dialed phone numbers using the Philippine standard while gracefully allowing international phone numbers to pass validation as well.

---

## Slide 10
Title - Cultural and Political Requirements (Part 2)
Bullets - 
* Clearly presents legal consent notices during registration and empowers users to export their personal data or legally request its permanent deletion.
* Follows strict data minimization principles by carefully avoiding the collection of unnecessary biometric records or sensitive government IDs.
* Rigorously follows Bangko Sentral ng Pilipinas guidelines for electronic record storage and expertly accommodates global business operations beyond standard local hours.

Script - 
Continuing closely with legal compliance, new users must legally agree to data consent notices during account signup. Any registered user has the legal right to export all their personal data in a readable computer file. We strictly only collect the data we actually need for the software to work, so no unnecessary biometric scans or government IDs are kept. If a customer wants to leave the platform, they can formally request permanent data deletion. For banking and finance clients, our record storage fully respects Bangko Sentral ng Pilipinas rules. Finally, our calendar respects standard Philippine business hours, but clients can seamlessly adjust it to match global operations.

---

## Slide 11
Title - Cultural and Political Requirements (Part 3)
Bullets - 
* Safely hosts crucial audit logs according to local and international cloud limits, actively enforcing strict structural safeguards for moving data across borders.
* Seamlessly accepts entirely localized, diverse character sets for names via international UTF 8 encoding and allows manual configuration of regional date formats.
* Consistently maintains telecom and privacy compliance by displaying E 164 standard phone codes (+63) and automatically appending mandated SMS disclaimer notices.

Script - 
To wrap up our final slide, the platform features a standard Philippine holiday calendar alongside international dates. Our audit logs are safely stored according to strict local data jurisdiction laws and cross border safeguards. The platform lets users type their names in their native languages using international character sets. The date starts natively as month day year, but users can change it to match their country. Everything from correctly showing the phone country code of plus 63, to providing proper SMS legal disclaimers, ensures we consistently maintain telecom and privacy compliance every step of the way. Thank you for your time today.
