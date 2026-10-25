# تطبيق اتحاد طلاب كلية التمريض — جامعة الريادة

PWA عربية (RTL) لاتحاد الطلاب: أخبار، فعاليات ومؤتمرات مع تسجيل حضور، استطلاعات، ميديا، لجان وأعضاء، ترتيب الطلاب، إشعارات، ولوحة تحكم للأدمن.

## التقنيات
- HTML / CSS / JavaScript عادي (من غير build)
- Firebase Auth + Firestore (SDK compat)
- Cloudinary لرفع الصور (unsigned preset)
- Service Worker + Web App Manifest

## هيكل المشروع
```
index.html            الصفحة الوحيدة
css/style.css         الستايل
js/01-core.js         Firebase + مستمعات Firestore + تسجيل دخول الأدمن
js/02..13-*.js        الأقسام (استطلاعات، ميديا، أنشطة، أخبار، أدمن، إشعارات، تهيئة)
sw.js                 Service Worker (رقم النسخة بيتغيّر تلقائي)
firestore.rules       قواعد أمان Firestore
firebase.json         إعداد نشر الـ rules
scripts/bump-sw.sh    تغيير نسخة الكاش يدوي
.github/workflows/    CI + تحديث نسخة الـ SW
```

## التشغيل محلياً
أي سيرفر ملفات ثابتة يكفي (الـ Service Worker محتاج http وليس file://):
```
npx serve .
```

## الإعداد
1. عدّل `firebase-config.js` ببيانات مشروع Firebase وCloudinary. (مفتاح Firebase للويب مش سر، لكن قيّده بالدومينات من Google Cloud Console → Credentials → HTTP referrers.)
2. فعّل Auth providers (Google و/أو Email-Password).
3. انشر القواعد:
   ```
   npm i -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules
   ```

## الأدمن
الصلاحيات الحقيقية في `firestore.rules`، والواجهة بس بتخفي/تظهر اللوحة. الأدمن هو:
- إيميل مؤكَّد (email_verified) من القايمة في `firestore.rules` و`ADMIN_EMAILS` في `js/01-core.js`، أو
- مستخدم له وثيقة `admins/{uid}` (تتضاف من Firebase Console بس، الكتابة من التطبيق ممنوعة).

لو بتدخل بإيميل/باسورد وإيميلك مش مؤكد: ادخل بجوجل أو أضف وثيقة `admins/{uid}`.

## النشر وتحديث النسخة
أي push على `main` بيغيّر ملفات التطبيق بيشغّل workflow بيحدّث `CACHE_NAME` في `sw.js` تلقائي. ولو بتشتغل محلياً: `sh scripts/bump-sw.sh`.

## ملاحظات
- المستمعات في `01-core.js` محدودة بـ `limit()` (مثلاً الأخبار 300) عشان القراءات تفضل محدودة.
- عند إضافة ملف JS/CSS جديد ضيفه في `ASSETS` في `sw.js` (الـ CI بيتأكد إنه موجود).
