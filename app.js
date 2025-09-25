import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from "multer";
import fs from 'fs';
import {db,storage} from "./config/firebase.js";
import  {uploadBytes, ref as  storageRef, getDownloadURL,listAll,deleteObject,getMetadata } from "firebase/storage"
import { get, ref as dbRef,remove, push, set, } from "firebase/database";
import { fileURLToPath } from 'url';
import { fromBuffer } from "pdf2pic";
// const {initializeApp  } = require("firebase/app");

// app setting
const app = express()
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT ||8080;
const upload = multer({ storage:  multer.memoryStorage() }); 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase



//get
app.get("/api/calendar", async (req, res) => {
  try {
      const userRef = dbRef(db, 'dates/');
      const snapshot = await get(userRef);

      if (!snapshot.exists()) {
          return res.json([]);
      }

      const data = snapshot.val();

      const dates = Object.keys(data).map(key => ({
          ...data[key],
          end: new Date (data[key].end),
          start: new Date (data[key].start),
          id: key
      }));
      res.json(dates);
  } catch (error) {
      console.error("Error fetching calendar data:", error);
      res.status(500).json({ error: "Failed to fetch calendar data" });
  }
});
app.get("/api/get/newsletter", async(req, res)=>{
  console.log('here', req.query.month)
  try{
    const listResult = await listAll(storageRef(storage, `newletter-images/${req.query.month}`));
    const newsList = new Array(listResult.items.length);

    const x = await Promise.all(
      listResult.items.map(async (itemRef) => {
        const [url, metadata] = await Promise.all([
          getDownloadURL(itemRef),
          getMetadata(itemRef),
        ]);

        const pageIndex = metadata.customMetadata?.page;
        if (pageIndex !== undefined) {
          newsList[pageIndex-1] = url;
        }

        return { name: itemRef.name, url };
      })
    );
    // console.log(newsList)
    res.status(200).json(newsList);
  }
  catch (err) {
    console.error("Error uploading file", err);
    res.status(500).json({ error: "get pdf failed" });
  }

})
app.get("/api/get/", async(req, res)=>{
  try {
      const userRef = dbRef(db, `pages/${req.query.folder}`);
      const snapshot = await get(userRef);

      if (!snapshot.exists()) {
          return res.json([]);
      }

      const data = snapshot.val();
      res.json(data);
  } catch (error) {
      console.error("Error fetching calendar data:", error);
      res.status(500).json({ error: "Failed to fetch calendar data" });
  }
})
app.get("/api/carousel", async (req, res) => {
  try {
    const listResult = await getImgsObject('carousel/');
    res.status(200).json(listResult);
  } catch (err) {
    console.error("Error listing files", err);
    res.status(500).json({ error: "Listing photos failed" });
  }
});
app.get("/api/photos", async (req, res) => {
  try {
    const listResult = await listAll(storageRef(storage, 'calendar-images/'));

    const items = await Promise.all(
      listResult.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return { name: itemRef.name, url: url };
      })
    );

    res.status(200).json(items);
  } catch (err) {
    console.error("Error listing files", err);
    res.status(500).json({ error: "Listing photos failed" });
  }
});

app.post("/api/send", async (req, res) => {     

  try {
    let snapshot;
    if(req.body.id){
      snapshot = set(dbRef(db, 'dates/'+req.body.id ), req.body)
    }
    else{
      snapshot = push(dbRef(db, 'dates/' ), req.body)
    }

    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
})
app.post("/api/carousel", async (req, res) => {
  try {
    const items = req.body;
    const folder = dbRef(db, 'carousel/');
    console.log(folder)
    await remove(folder);
    // Save each item to the database in parallel
    await Promise.all(
      items.map((item, i) => {
        return set(dbRef(db, 'carousel/' + i), item);
      })
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving carousel data:", error);
    res.status(500).json({ error: "Failed to save carousel data" });
  }
});

app.post("/api/data", async (req, res) => {     

  try {
    const snapshot = push(ref(db, `${req.query.folder}/` ), req.body)
    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
})
app.post("/api/page", async (req, res) => {     

  try {
    await Promise.all(
      req.body.map((item, i) => {
        return set(dbRef(db, `pages/${req.query.folder}/${i}`), item);
      })
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
})
app.post("/api/photo",upload.single('file'),  async (req, res) => {
  const file = req.file
  try {
    const fileBuffer = file.buffer;
    const og = file.originalname;

    const sRef = storageRef(storage, 'calendar-images/'+og);
    const metadata = {
      contentType: file.mimetype // or 'image/png', etc.
    };
    const result = await uploadBytes(sRef, fileBuffer,metadata);
    const url = await getDownloadURL(sRef);

    res.status(200).json(url);
  } catch (err) {
    console.error("Error uploading file", err);
    res.status(500).json({ error: "Upload failed" });
  }

});

const options = {
  density: 300,
  saveFilename: "untitled",
  savePath: "./images",
  format: "png",
};

app.post("/api/post/pdf", upload.single('file'), async (req, res) => {
  const file = req.file;
  console.log('here')

  try {
    
    if (file.mimetype !== 'application/pdf') {
      return res.status(500).json({ error: "Not a PDF file" });
    }

    const month = req.query.month - 1;
    console.log(month)
    // ✅ Upload original PDF to Firebase Storage
    const pdfRef = storageRef(storage, `newsletters/${month}.pdf`);
    await uploadBytes(pdfRef, file.buffer, {
      contentType: 'application/pdf',
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        month: month
      }
    });

    // Delete all images in Firebase storage under 'newsletter-images/{month}/'
    const listRef = storageRef(storage, `newletter-images/${month}/`);
    const { items } = await listAll(listRef);
    await Promise.all(items.map(item => deleteObject(item)));

    // Convert PDF to images
    const imgs = await fromBuffer(file.buffer, options);
    const jpgs = await imgs.bulk(-1, { responseType: "image" });

    for (const jpg of jpgs) {
      const sRef = storageRef(storage, `newletter-images/${month}/` + jpg.name);
      const buffer = fs.readFileSync(jpg.path);
      const result = await uploadBytes(sRef, buffer, { 
        contentType: 'image/png',
        customMetadata: {
          page: jpg.page,
        }
      });

      console.log(result.metadata.fullPath);
    }

    // Clean up local 'images' folder
    const imagesDir = path.resolve(__dirname, 'images');
    fs.readdir(imagesDir, (err, files) => {
      if (err) return console.error("Failed to list directory files:", err);
      files.forEach((file) => {
        const filePath = path.join(imagesDir, file);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`Failed to delete file ${filePath}:`, err);
          } else {
            console.log(`Deleted file: ${filePath}`);
          }
        });
      });
    });

    res.status(200).json('success');

  } catch (err) {
    console.error("Error uploading file", err);
    res.status(500).json({ error: "Upload pdf failed" });
  }
});

app.delete("/api/delete", async (req, res) => {     

  try {
    const userRef = dbRef(db, 'dates/'+ req.body.id); 
    const snapshot = await remove(userRef);
    console.log('pass');
    res.json(snapshot);
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
})
app.use(express.static(path.join(__dirname, "./build/client")))
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, "./build/client/index.html"));
});
app.listen(PORT, () =>{console.log("Server started" + PORT)})





async function getImgsObject(folder){
    try {
        const userRef = dbRef(db, folder);
        const snapshot = await get(userRef);
        console.log('does snapshot exist', snapshot.exists())
        if (snapshot.exists()) {
          const data = snapshot.val();
          const images = data.map((data) => {
            return data.photo;
          });
          return images;
        }

    } catch (error) {
        console.error("Error fetching calendar data:", error);
        return[]
    }
}