# Attendance Log · Registro de asistencia

**[EN/ES]**
This document has two versions: the original in English and a Spanish translation below.
Este documento tiene dos versiones: la original en inglés y una traducción al español más abajo.

---

## 🇬🇧 English

A quick demo prototype of an attendance and belt-tracking web app for martial arts classes.

The goal is to give the teacher in charge a simpler and faster way to take attendance and follow each student's belt progress. This is a first version of the idea, to be extended with more features and native mobile apps as needed.

The repository is open to suggestions, contributions and advice. I am the main author as of the repository's creation (2026-11-05); other collaborators will be credited here if they join.

### Roles

- **Admin teacher (sensei):** sees all groups, and manages the teaching team and which groups each teacher is assigned to.
- **Teacher:** sees only their own groups. Takes attendance, reviews requests, edits their students and promotes them.
- **Student:** creates their own account, and sees their belt, progress and attendance history. Occasionally, they can ask for a missing class to be reviewed.

### Accounts

- Students **register themselves** with their full name, username, email, password, the classes they attend and a **photo of themselves** (required, so the teacher can recognise them). They can change their photo, name and password later from their profile.
- Teacher accounts are created by the admin.
- Everyone logs in with their username or email and password.
- Until someone has a photo, the app shows their initials in a coloured circle.

### How it works

**Attendance is recorded only by teachers.**

1. The teacher logs in, and today's current (or next) class for their groups opens automatically.
2. Only students enrolled in that group are shown, regulars first. Everyone starts as absent.
3. One tap marks a student present; **Todos presentes** marks everyone. **Guardar asistencia** saves it.

**Requests (occasional, not daily).** If a student attended a class but it is missing from their history, they can request a review:

- They can choose only classes from their own groups in the last 14 days where they are not marked present.
- They can add a short note for the teacher.
- The teacher approves or rejects it in the **Solicitudes** tab. Approval records the attendance, and it counts towards belt progress.
- If the teacher marks the student present in that day's roster anyway, the request is approved automatically.

**Belts and stripes.**

- Each student has a belt system (BJJ adults or BJJ kids), a belt and 0–4 stripes. New students start as white belt; the teacher can correct it (e.g. for someone who arrives with another belt).
- Each belt has its own number of classes per stripe (adults: white 35, blue 65, purple 75, brown 85, black 1000 per degree). After the 4th stripe, one more block of classes leads to the next belt. Students see how many classes they need for the next stripe and for the next belt.
- Belt changes also need a minimum time at the current belt, following the IBJJF graduation system: blue 2 years, purple 1.5 years, brown 1 year, 3 years per black-belt degree.
- All numbers live in `shared/belts.js` and are only guidelines: the teacher decides.
- Students who reach the guideline are flagged "★ listo para grado".
- Promotions and corrections are saved to a history (date, from, to, teacher).

### Timetable

The demo uses the dojo's real BJJ and grappling timetable, defined in `netlify/lib/seed.mjs`:

|         | Mon            | Tue                   | Wed            | Thu                   | Fri            | Sat               |
| ------- | -------------- | --------------------- | -------------- | --------------------- | -------------- | ----------------- |
| Morning | Jiujitsu 10:00 | Grappling 9:30        | Jiujitsu 10:00 | Grappling 9:30        | Jiujitsu 10:00 | Clase libre 10:00 |
| 18:00   |                | Jiujitsu Kids         |                | Jiujitsu Kids         |                |                   |
| 19:00   |                | Jiujitsu Introducción |                | Jiujitsu Introducción | Jiujitsu       |                   |
| 20:00   |                | Grappling             |                | Grappling             | Grappling      |                   |
| 21:00   | Jiujitsu       |                       | Jiujitsu       |                       |                |                   |

All classes are assumed to last 1 hour.

### Tech stack

- **Frontend:** Vue 3, Vite, Tailwind CSS 3, Vue Router (hash mode), Heroicons
- **Backend:** a single Netlify Function (`netlify/functions/api.mjs`)
- **Storage:** Netlify Blobs, with no external database to set up
- **Auth:** passwords hashed with scrypt; login returns a signed Bearer token (HMAC-SHA256, 12 h expiry); role and group checks on every request
- **Photos:** cropped and resized in the browser to 256×256 JPEG (~20–30 KB) before upload

### Project structure

    shared/belts.js          Belt systems and promotion rules (used by frontend and backend)
    netlify/
      functions/api.mjs      REST API
      lib/seed.mjs           Demo data: groups, timetable, teachers, students, 4 weeks of history
      lib/passwords.mjs      Password hashing
    src/
      config/apiConfig.js    API base URL and headers
      composables/           useAuth (session), useDojo (data and API calls)
      router/                Routes and role-based navigation guard
      views/                 Home, LoginForm, RegisterForm, ProfilePage, StudentPage,
                            RosterPage, RequestsPage, StudentsPage, TeachersPage
      components/            Avatar, PhotoInput, BeltBar, StudentModal, TeacherModal, TeacherNav, ...
      utils/                 image.js (photo resize), format.js

### Running locally

    npm install
    npm install -g netlify-cli
    netlify dev

Open http://localhost:8888. Use this port rather than Vite's 5173, because `netlify dev` also serves the API and a local Blobs store.

### Deploying

1. Import the repository in Netlify. The build settings are read from `netlify.toml`.
2. Add the environment variable `TOKEN_SECRET` with a long random string.
3. Trigger a new deploy.

### Demo accounts

All demo accounts use the password `demo1234`.

| User                         | Role                            |
| ---------------------------- | ------------------------------- |
| `marta`                      | Admin teacher, adult groups     |
| `alex`                       | Teacher, Kids and Introducción  |
| `laia`, `aitana`, `bruno`, … | Students (lowercase first name) |

### API

| Method          | Route                       | Access  | Description                                                          |
| --------------- | --------------------------- | ------- | -------------------------------------------------------------------- |
| GET             | `/api/groups`               | public  | Classes students can sign up for                                     |
| POST            | `/api/register`             | public  | Student sign-up (photo required)                                     |
| POST            | `/api/login`                | public  | Username or email + password → token                                 |
| GET/PUT         | `/api/profile`              | any     | Own profile: name, photo, password                                   |
| GET             | `/api/me`                   | student | Belt, progress, history, requests                                    |
| POST            | `/api/requests`             | student | Request review of a missing class                                    |
| GET             | `/api/teacher/state`        | teacher | Classes, students, today's attendance, pending requests (own groups) |
| PUT             | `/api/attendance/:classId`  | teacher | Save today's attendance for a class                                  |
| POST            | `/api/requests/:id/approve` | teacher | Approve request (records attendance)                                 |
| POST            | `/api/requests/:id/reject`  | teacher | Reject request, with optional reply                                  |
| PUT             | `/api/students/:id`         | teacher | Edit name, groups, belt correction                                   |
| POST            | `/api/students/:id/promote` | teacher | Next stripe or belt, saved to history                                |
| DELETE          | `/api/students/:id`         | teacher | Delete student and their records                                     |
| POST/PUT/DELETE | `/api/teachers[/:id]`       | admin   | Manage teachers and their groups                                     |
| POST            | `/api/reset`                | admin   | Reset to demo data                                                   |

### Known limitations

This is a demo, not production software:

- No login rate limiting, email verification or password reset yet.
- All data lives in a single JSON document, which is fine for one dojo but not for many simultaneous writers.
- Attendance can be taken only for today's classes; past days are corrected through approved requests.
- Groups and the timetable are defined in `seed.mjs` and can't yet be edited from the app.
- Kids' belt colours are simplified (no white/black-striped variants).
- Student photos are personal data. Under GDPR and Spanish law (LOPDGDD), children under 14 must be registered by a parent or guardian; a proper privacy notice is needed before real use.

### Roadmap

- Edit groups and the timetable from the app
- Password reset by email
- Attendance reports and export (CSV)
- Grading history view and printable certificates
- Installable web app (PWA), then native iOS/Android apps
- Proper database (e.g. PostgreSQL/Supabase)
- Later: QR/NFC check-in at the entrance

### Contact

For requests, comments, advice, contributions or suggestions, open an issue or contact me through my GitHub profile: [@mariagarciapenalva](https://github.com/mariagarciapenalva).

---

## 🇪🇸 Español

Prototipo rápido, en modo demo, de una aplicación web de registro de asistencia y seguimiento de cinturones para clases de artes marciales.

El objetivo es ofrecer al profesor a cargo una forma más simple y rápida de pasar lista y de seguir el progreso de cinturón de cada alumno. Es una primera versión de la idea, que podrá ampliarse con más funcionalidades y apps móviles nativas según se necesite.

El repositorio está abierto a sugerencias, contribuciones y consejos. Soy la autora principal a fecha de creación del repositorio (2026-11-05); si se suman otras personas, se las mencionará aquí.

### Roles

- **Profesor administrador (sensei):** ve todos los grupos y gestiona el equipo de profesores y qué grupos tiene asignados cada uno.
- **Profesor:** solo ve sus grupos. Pasa lista, revisa solicitudes, edita a sus alumnos y los promociona.
- **Alumno:** crea su propia cuenta y ve su cinturón, su progreso y su historial de asistencia. De forma puntual, puede pedir que se revise una clase que no le consta.

### Cuentas

- Los alumnos **se registran ellos mismos** con nombre y apellidos, nombre de usuario, email, contraseña, las clases a las que vienen y **una foto suya** (obligatoria, para que el profesor los reconozca). Después pueden cambiar la foto, el nombre y la contraseña desde su perfil.
- Las cuentas de profesor las crea el administrador.
- Todos entran con su nombre de usuario o email y su contraseña.
- Mientras alguien no tenga foto, la app muestra sus iniciales en un círculo de color.

### Cómo funciona

**La asistencia solo la registra el profesor.**

1. El profesor entra y se abre automáticamente la clase en curso (o la siguiente) de sus grupos.
2. Solo aparecen los alumnos inscritos en ese grupo, primero los más habituales. Todos empiezan como ausentes.
3. Un toque marca a un alumno como presente; **Todos presentes** marca a todos. **Guardar asistencia** la guarda.

**Solicitudes (puntuales, no diarias).** Si un alumno vino a una clase y no le consta en su historial, puede pedir que se revise:

- Solo puede elegir clases de sus grupos de los últimos 14 días en las que no conste como presente.
- Puede añadir una nota breve para el profesor.
- El profesor la aprueba o la rechaza en la pestaña **Solicitudes**. Al aprobarla, la asistencia queda registrada y cuenta para el progreso de cinturón.
- Si el profesor lo marca como presente al pasar lista ese mismo día, la solicitud se aprueba sola.

**Cinturones y grados.**

- Cada alumno tiene un sistema de cinturones (BJJ adultos o BJJ infantil), un cinturón y de 0 a 4 grados. Los alumnos nuevos empiezan con cinturón blanco; el profesor puede corregirlo (por ejemplo, si alguien llega con otro cinturón).
- Cada cinturón tiene su propio número de clases por grado (adultos: blanco 35, azul 65, morado 75, marrón 85, negro 1000 por grado). Tras el 4.º grado, un bloque más de clases lleva al siguiente cinturón. El alumno ve cuántas clases le faltan para el siguiente grado y para el siguiente cinturón.
- Los cambios de cinturón exigen además un tiempo mínimo en el cinturón actual, según el sistema de graduación de la IBJJF: azul 2 años, morado 1,5 años, marrón 1 año y 3 años por grado de cinturón negro.
- Todas las cifras están en `shared/belts.js` y son orientativas: decide el profesor.
- Los alumnos que llegan a esa cifra aparecen marcados como "★ listo para grado".
- Las promociones y correcciones quedan guardadas en un historial (fecha, de qué a qué, qué profesor).

### Horario

La demo usa el horario real de BJJ y grappling del dojo (tabla en la sección en inglés), definido en `netlify/lib/seed.mjs`. Se supone que todas las clases duran 1 hora.

### Instalación, despliegue y API

Los comandos, la variable de entorno `TOKEN_SECRET`, las cuentas de demo (contraseña `demo1234`) y la tabla de la API son los mismos que en la sección en inglés.

### Limitaciones conocidas

Es una demo, no software de producción:

- Todavía no hay límite de intentos de inicio de sesión, verificación de email ni recuperación de contraseña.
- Todos los datos están en un único documento JSON: sirve para un dojo, pero no para muchas escrituras simultáneas.
- Solo se puede pasar lista de las clases del día; los días anteriores se corrigen mediante solicitudes aprobadas.
- Los grupos y el horario están definidos en `seed.mjs` y aún no se pueden editar desde la app.
- Los colores de cinturón infantil están simplificados (sin las variantes con franja blanca o negra).
- Las fotos de los alumnos son datos personales. Según el RGPD y la LOPDGDD, a los menores de 14 años los tiene que registrar su madre, padre o tutor; antes del uso real hace falta un aviso de privacidad en condiciones.

### Próximos pasos

- Editar grupos y horarios desde la app
- Recuperación de contraseña por email
- Informes de asistencia y exportación (CSV)
- Historial de graduaciones y diplomas imprimibles
- App web instalable (PWA) y, más adelante, apps nativas para iOS y Android
- Base de datos real (p. ej. PostgreSQL/Supabase)
- Más adelante: registro con QR/NFC en la entrada

### Contacto

Para cualquier petición, comentario, consejo, contribución o sugerencia, abre una issue o contáctame a través de mi perfil de GitHub: [@mariagarciapenalva](https://github.com/mariagarciapenalva). ¡No dudes en escribirme!
