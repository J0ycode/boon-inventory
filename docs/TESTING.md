# Testing checklist

**Start the app:** run `pnpm db:start`, then `pnpm dev`, and open http://boonbaby.localhost:3000. All demo logins use the password `123` (or pick one from the Demo account dropdown) (see the README).

Check every screen on a phone, a tablet and a computer. To mimic a phone or tablet on a computer, use the device toolbar in Chrome DevTools.

**Automated tests:** to run them, use `pnpm test`, `pnpm db:test` and `pnpm e2e` (run `pnpm e2e:install` once first).

## 1. Signup and first run
- [ ] Open http://localhost:3000, then go to **Create your shop**. Typing a shop name fills in the shop address, and "available" appears next to it.
- [ ] A taken address (`boonbaby`) shows "That address is taken".
- [ ] After creating the shop you land on its login page with your email filled in. Sign in.
- [ ] The owner dashboard shows the **setup checklist**. Each step ticks off as you complete it, and the checklist disappears when all five are done.

## 2. Products and suppliers (Store Room manager: storeroom@boonbaby.test)
- [ ] Add a supplier. Add a product with and without a barcode; a blank barcode or SKU is generated automatically.
- [ ] Upload a product photo.
- [ ] Import products from a CSV or XLSX file. The preview shows errors before anything is saved.
- [ ] Search by name, SKU and barcode. Typing a barcode and pressing Enter (as a USB scanner does) finds the product.

## 3. Receive stock and purchase bills
- [ ] Receive stock marked **Paid**. The Store Room quantity goes up.
- [ ] Receive stock marked **Unpaid** with no deadline. Saving should be blocked. Add a deadline and attach a PDF or photo.
- [ ] Receiving the same invoice number from the same supplier again is refused.
- [ ] On the receipt page:
  - [ ] **View bill** opens the file.
  - [ ] Try **Replace file**, **Remove file**, **Edit payment** and **Mark as paid**.
- [ ] On **Purchase Bills** (under "More"):
  - [ ] The Unpaid, Overdue, Paid and All tabs work.
  - [ ] The totals are correct.
  - [ ] A bill past its deadline shows as Overdue.
  - [ ] The notification bell lists bills that are overdue or due within 3 days.
- [ ] A file over 10 MB, or a Word document, is rejected with a clear message.
- [ ] Store staff can't see Purchase Bills.

## 4. Dispatch
- [ ] Create a dispatch to Store A and send it. Store Room stock goes down.
- [ ] You can't send more than the Store Room has.
- [ ] Print or download the dispatch note.
- [ ] As **storea@**, receive it with some pieces marked missing or damaged.
- [ ] As the manager, resolve the discrepancy two ways: **return to stock** and **write off**.
- [ ] Store B staff can't see Store A's dispatches or stock.

## 5. Restock
- [ ] Store staff send a manual restock request, and the manager approves it. A draft dispatch is created.
- [ ] As the manager, use **Generate suggestions**. Store staff approve, edit or skip each line, then forward the request.
- [ ] The Store Room doesn't see a suggestion until staff forward it.
- [ ] Rejecting a request works.

## 6. Returns and damage
- [ ] Store staff record a return and a damaged item. The manager approves one and rejects the other, and stock changes only for the approved one.
- [ ] The manager records damage or a supplier return at the Store Room. It applies immediately.

## 7. Sales API
- [ ] Create a key in Owner → Settings and copy a Store ID.
- [ ] POST a sale (see README → Sales API). The response is `201`, and the store's stock goes down.
- [ ] Send the same `external_ref` again. The response is `200` with `duplicate: true`, and stock is unchanged.
- [ ] Each of these returns the right error:
  - [ ] a wrong key: `401`
  - [ ] an unknown barcode: `422`
  - [ ] more than the store has: `409`
- [ ] A revoked key stops working.

## 8. Labels, reports and dashboards
- [ ] Print labels for a recent receipt. Try the 24, 40 and 65 per sheet layouts and a different start position. The PDF lines up on the sheet.
- [ ] Barcodes scan from the printed labels.
- [ ] Each of the five reports works with date and location filters. Export each one as CSV, XLSX and PDF.
- [ ] Store staff's **Stock History** shows only their own store.
- [ ] Each role's dashboard numbers match what you did above.

## 9. Team and settings (Owner)
- [ ] Invite a user. The invite email appears in Mailpit (http://127.0.0.1:54324). Set a password and sign in.
- [ ] Deactivate a user. They can no longer sign in.
- [ ] Password reset by email works.
- [ ] **Export all data** downloads a zip of CSV files that open in Excel.

## 10. Phones and the installable app (real devices)
Run `pnpm build`, then `pnpm start`. The service worker only runs in a production build, and phones need HTTPS for the camera: use a tunnel such as `cloudflared` or `ngrok`, or deploy a preview.
- [ ] **Android Chrome:**
  - [ ] "Install app" or **Add to Home screen** works.
  - [ ] It opens full screen with the BB icon.
- [ ] **iPhone Safari:**
  - [ ] **Share → Add to Home Screen** works.
  - [ ] The icon looks right.
  - [ ] Content isn't hidden behind the notch or the home bar.
- [ ] **Camera scanning:**
  - [ ] The **Scan** button opens the camera and reads a product barcode on both phones.
  - [ ] Denying camera permission shows the type-it-in fallback.
- [ ] **Offline:** turn on aeroplane mode and open a page. The "You're offline" screen appears, and **Try again** works once you're back online.
- [ ] Nothing scrolls sideways on a narrow phone (360 px wide). The bottom navigation and buttons are easy to tap.
- [ ] Dark mode looks right.

## 11. Security spot checks
- [ ] Logged in as `boonbaby`, open `tinytots.localhost:3000`. You must not see any of the other shop's data.
- [ ] Store staff opening `/storeroom/...` or `/owner/...` URLs directly get redirected away.
- [ ] Every stock change appears in the reports' movement history and the activity log.
