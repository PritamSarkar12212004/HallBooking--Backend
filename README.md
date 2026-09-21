# HallBooking--Backend

## App access — kaun app use kar sakta hai

Sirf **whitelisted numbers** hi app use kar sakte hain.

Numbers kahan add karne hain:

1. `src/access/access.config.ts`
   - `CEO_ACCESS` → CEO numbers (CEO tabs + reports + payment QR)
   - `ADMIN_ACCESS` → admin/staff numbers (app use kar sakte hain, CEO-only cheezein nahi)
2. Ya env se (code edit kiye bina, deploy ke waqt):
   - `CEO_PHONES=7796419792,98xxxxxxxx`
   - `ADMIN_PHONES=97xxxxxxxx`
   - `ACCESS_GATE_ENABLED=false` → gate band (local testing)

Kya rok lagega:

| Request | Non-whitelisted number |
| --- | --- |
| `POST /api/v1/auth/send-otp` | `403` + `code: ACCESS_DENIED` (SMS nahi jaata) |
| `POST /api/v1/auth/verify-otp` | `403` + `code: ACCESS_DENIED` |
| Har authenticated route (purana token bhi) | `403` + `code: ACCESS_DENIED` |

Poora rules `src/access/access.service.ts` me hain (normalize, lookup, gate).

- Role access list se hi set hota hai (`CEO` → `ceo`, `ADMIN` → `admin`) — DB me
  manually badalne ki zaroorat nahi, agli login par sync ho jaata hai.
- Login/OTP ke response me `user.accessRole` aata hai; app isi se CEO UI deti hai.
- Boot par allowed numbers log hote hain: `App access gate ON … allowedNumbers`.
