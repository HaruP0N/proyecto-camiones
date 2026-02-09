import piexif from 'piexifjs';

/**
 * Abre la cámara nativa, procesa la imagen, inyecta EXIF y genera thumbnail.
 */
export async function capturePhoto() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Fuerza cámara trasera en móviles

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        // 1. Obtenemos la metadata (GPS + Timestamp) ANTES de procesar la imagen
        const metadata = await buildMetadata();

        // 2. Redimensionamos e INYECTAMOS el EXIF en el Blob
        const blobConExif = await processImage(file, metadata);

        // 3. Generamos el thumbnail (ligero, sin EXIF necesario)
        const thumbnail = await generateThumbnail(blobConExif);

        resolve({ 
          blob: blobConExif, 
          thumbnail, 
          metadata 
        });
      } catch (err) {
        reject(err);
      }
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * Redimensiona la imagen y llama a la inyección de EXIF
 */
async function processImage(file, metadata) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const maxWidth = 1920;
      let w = img.width;
      let h = img.height;

      // Mantener aspect ratio
      if (w > maxWidth) {
        h = (maxWidth / w) * h;
        w = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // Convertir a Blob JPEG
      canvas.toBlob(async (blob) => {
        URL.revokeObjectURL(url);
        
        if (!blob) {
          reject(new Error('Error al crear blob de imagen'));
          return;
        }

        try {
          // AQUÍ LA MAGIA: Inyectar EXIF antes de devolver
          const blobFinal = await embedExif(blob, metadata);
          resolve(blobFinal);
        } catch (error) {
          console.warn('Falló inyección EXIF, devolviendo imagen limpia', error);
          resolve(blob); // Fallback: devolver imagen sin EXIF si falla
        }

      }, 'image/jpeg', 0.85); // Calidad 85%
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al procesar imagen'));
    };

    img.src = url;
  });
}

/**
 * Inyecta metadata EXIF (GPS y Fecha) en un Blob JPEG usando piexifjs
 */
async function embedExif(imageBlob, metadata) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const jpegData = e.target.result; // DataURL (Base64)

      // 1. Estructura EXIF vacía
      const exifObj = {
        "0th": {},
        "Exif": {},
        "GPS": {}
      };

      // 2. Insertar Fecha (Formato requerido: "YYYY:MM:DD HH:MM:SS")
      // Usamos el timestamp capturado en metadata o el actual
      const dateObj = new Date(metadata.timestamp || Date.now());
      const dateStr = dateObj.toISOString().replace(/[-T]/g, ':').split('.')[0];
      
      exifObj["0th"][piexif.ImageIFD.DateTime] = dateStr;
      exifObj["Exif"][piexif.ExifIFD.DateTimeOriginal] = dateStr;
      exifObj["Exif"][piexif.ExifIFD.DateTimeDigitized] = dateStr;

      // 3. Insertar GPS (Si tenemos coordenadas válidas)
      if (metadata.gps_coords && metadata.gps_coords.lat !== 0) {
        const lat = metadata.gps_coords.lat;
        const lng = metadata.gps_coords.long;

        exifObj["GPS"][piexif.GPSIFD.GPSLatitudeRef] = lat < 0 ? 'S' : 'N';
        exifObj["GPS"][piexif.GPSIFD.GPSLatitude] = degToDmsRational(Math.abs(lat));
        exifObj["GPS"][piexif.GPSIFD.GPSLongitudeRef] = lng < 0 ? 'W' : 'E';
        exifObj["GPS"][piexif.GPSIFD.GPSLongitude] = degToDmsRational(Math.abs(lng));
        
        // Precisión/Altitud podría agregarse si se desea, pero Lat/Long es lo crítico
      }

      // 4. Inyectar en el binario
      const exifBytes = piexif.dump(exifObj);
      const newJpeg = piexif.insert(exifBytes, jpegData);

      // 5. Convertir Base64 resultante de vuelta a Blob
      const byteCharacters = atob(newJpeg.split(',')[1]);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      
      resolve(new Blob([byteArray], { type: 'image/jpeg' }));
    };
    reader.readAsDataURL(imageBlob);
  });
}

/**
 * Convierte grados decimales a formato racional DMS para EXIF
 * Ejemplo: -33.45 => [[33,1], [27,1], [0,100]]
 */
function degToDmsRational(deg) {
  const d = Math.floor(deg);
  const minFloat = (deg - d) * 60;
  const m = Math.floor(minFloat);
  const s = Math.round((minFloat - m) * 60 * 100); // Segundos * 100 para precisión
  return [[d, 1], [m, 1], [s, 100]];
}

/**
 * Genera una miniatura pequeña para la UI
 */
async function generateThumbnail(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const thumbWidth = 200;
      const ratio = thumbWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = thumbWidth;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((thumbBlob) => {
        URL.revokeObjectURL(url);
        resolve(thumbBlob);
      }, 'image/jpeg', 0.7);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error generando thumbnail')); };
    img.src = url;
  });
}

/**
 * Obtiene GPS y Timestamp del dispositivo
 */
async function buildMetadata() {
  const timestamp = new Date().toISOString();
  let gps_coords = { lat: 0, long: 0, accuracy: 0 };

  try {
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!isSecure) {
      console.warn('No se pudo obtener GPS: conexión no segura (fallback 0,0)');
      return {
        timestamp,
        gps_coords,
        device_info: {
          user_agent: navigator.userAgent,
          screen_resolution: `${window.screen.width}x${window.screen.height}`
        }
      };
    }

    const pos = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // No usar caché, queremos posición actual
      });
    });
    
    gps_coords = {
      lat: pos.coords.latitude,
      long: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    };
  } catch (err) {
    console.warn('No se pudo obtener GPS:', err);
    // GPS no disponible, guardamos con 0,0 pero el timestamp es válido
  }

  return {
    timestamp,
    gps_coords,
    device_info: {
      user_agent: navigator.userAgent,
      screen_resolution: `${window.screen.width}x${window.screen.height}`
    }
  };
}
