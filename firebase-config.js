/* =========================================================================
   بيانات الاتصال بمشروع Firebase بتاعك
   ملهاش أي علاقة بباقي كود التطبيق — بس افتح Firebase Console، وادخل على
   Project settings > عمل Web App (أيقونة </>)، وهيديك كائن زي ده بالظبط.
   انسخ القيم وحطها هنا بدل الكلام اللي بين علامتي التنصيص.
   ========================================================================= */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAX3aOwXBqKZw4_IMooGpnJML_BXH5SUJk",
  authDomain: "nursing-union-5ab79.firebaseapp.com",
  projectId: "nursing-union-5ab79",
  storageBucket: "nursing-union-5ab79.firebasestorage.app",
  messagingSenderId: "1007823819655",
  appId: "1:1007823819655:web:81ab7186c42ba1d3df7922"
};

/* =========================================================================
   بيانات رفع الصور على Cloudinary (بديل Firebase Storage اللي بقى محتاج فيزا)
   1. اعمل حساب مجاني على cloudinary.com (من غير فيزا)
   2. من الـ Dashboard انسخ قيمة "Cloud name" وحطها في CLOUDINARY_CLOUD_NAME
   3. روح Settings > Upload > Upload presets > Add upload preset
      واختار Signing Mode = "Unsigned"، احفظ، وانسخ اسم الـ preset
      وحطه في CLOUDINARY_UPLOAD_PRESET
   ========================================================================= */
const CLOUDINARY_CLOUD_NAME = "dju33knsd";
const CLOUDINARY_UPLOAD_PRESET = "unihub_uploads";
