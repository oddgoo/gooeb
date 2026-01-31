# Pre-Party Checklist for The Gooeb

## 1 Week Before

### Infrastructure
- [ ] Vercel deployment live and tested
- [ ] Custom domain configured (megamindmeld.vercel.app)
- [ ] SSL certificate working
- [ ] Environment variables set in Vercel

### Supabase
- [ ] Database migration applied
- [ ] `photos` storage bucket created and public
- [ ] Realtime enabled on `bonds` and `guests` tables
- [ ] Connection pooling adequate for 50+ concurrent users

### Data Preparation
- [ ] Event record created in `events` table
- [ ] 60+ mask codes generated in `mask_codes` table (buffer for 40-55 guests)
- [ ] Prompts seeded (15 per category: character, theme, place)
- [ ] Admin account created (guest with `is_admin = true`)

### NFC Tags
- [ ] All NFC tags programmed with unique URLs: `megamindmeld.vercel.app/join/XXXX`
- [ ] Test 3-5 tags with different phones
- [ ] QR code fallbacks printed (for non-NFC phones)
- [ ] Backup manual code entry process tested

---

## 3 Days Before

### Load Testing
- [ ] Run load test: `npx tsx scripts/load-test.ts https://megamindmeld.vercel.app`
- [ ] All endpoints respond under 1s at P95
- [ ] Success rate > 99%
- [ ] No database connection errors

### End-to-End Testing
- [ ] Complete flow on iPhone (Safari)
- [ ] Complete flow on Android (Chrome)
- [ ] NFC tap registration works
- [ ] Photo capture works (camera + file upload)
- [ ] Bond invite → accept → complete flow works
- [ ] Showcase updates in real-time
- [ ] Admin panel functional

### Showcase Display
- [ ] Test on actual big screen hardware
- [ ] 16:9 aspect ratio renders correctly
- [ ] Network graph readable from distance
- [ ] Confetti animations working
- [ ] Photo slideshow cycling

---

## Day Before

### Final Checks
- [ ] Fresh build deployed: `vercel --prod`
- [ ] Database backed up
- [ ] Clear any test data from database
- [ ] Reset mask codes: all `is_claimed = false`
- [ ] Admin credentials memorized/saved

### Hardware Setup
- [ ] Showcase display computer ready
- [ ] Stable WiFi for display
- [ ] Backup hotspot available
- [ ] Extension cords/power sorted

### Communication
- [ ] Brief helpers on troubleshooting
- [ ] Print instruction cards for guests
- [ ] Emergency contact list (you!)

---

## Day Of (2 hours before)

### Systems Check
- [ ] Open showcase in browser, enter fullscreen
- [ ] Test one NFC tap end-to-end
- [ ] Verify Supabase is responding
- [ ] Verify Vercel functions are warm

### Monitor URLs
- [ ] Vercel Dashboard: `vercel.com/[your-team]/gooeb`
- [ ] Supabase Dashboard: Database & Realtime health
- [ ] Admin Panel: `megamindmeld.vercel.app/admin`

---

## During Party (Monitoring)

### Watch For
- [ ] Realtime connection drops (refresh showcase if stuck)
- [ ] Photo upload failures (check Supabase storage)
- [ ] Bond stuck in pending (check admin panel)
- [ ] NFC not triggering (offer manual code entry)

### Quick Fixes
| Issue | Fix |
|-------|-----|
| Guest can't register | Manual code entry, check mask_codes table |
| Photo won't upload | Try file upload instead of camera |
| Bond stuck pending | Check admin panel, manually complete if needed |
| Showcase frozen | Hard refresh (Cmd+Shift+R) |
| "Code already claimed" | Check if guest registered on different phone |

---

## Post-Party

- [ ] Export final bond data
- [ ] Download all photos from Supabase storage
- [ ] Screenshot final network graph
- [ ] Celebrate success!

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Developer | [Your phone] |
| Venue WiFi | [Contact info] |
| Supabase Support | support.supabase.com |

---

## Quick Reference Commands

```bash
# Run load test
npx tsx scripts/load-test.ts https://megamindmeld.vercel.app

# Check build locally
npm run build && npm run preview

# Deploy to production
vercel --prod

# View Vercel logs
vercel logs

# Check database (Supabase SQL Editor)
SELECT COUNT(*) FROM guests WHERE event_id = 1;
SELECT COUNT(*) FROM bonds WHERE status = 'completed';
```
