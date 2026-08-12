// ============================================================
// KONFIGURASI AWAL
// ============================================================
const PUSAT_PETA = [4.330, 98.020]; // fallback, akan di-override oleh batas_area.geojson kalau ada
const ZOOM_AWAL = 15;

const map = L.map('map', { zoomControl: false }).setView(PUSAT_PETA, ZOOM_AWAL);
L.control.zoom({ position: 'topleft' }).addTo(map);

// ============================================================
// BASEMAP (3 pilihan: OSM, Satelit, Topografi)
// ============================================================
const basemapOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
});

const basemapSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri',
  maxZoom: 19
});

const basemapTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenTopoMap contributors',
  maxZoom: 17
});

basemapOSM.addTo(map); // default aktif

// Toggle basemap (tombol OSM / Satelit / Topografi)
const daftarBasemap = {
  osm: { layer: basemapOSM, btn: document.getElementById('btn-osm') },
  satellite: { layer: basemapSatellite, btn: document.getElementById('btn-satellite') },
  topo: { layer: basemapTopo, btn: document.getElementById('btn-topo') }
};
let basemapAktif = 'osm';

function gantiBasemap(key) {
  if (key === basemapAktif) return;
  map.removeLayer(daftarBasemap[basemapAktif].layer);
  daftarBasemap[basemapAktif].btn.classList.remove('active');

  basemapAktif = key;
  daftarBasemap[key].layer.addTo(map);
  daftarBasemap[key].btn.classList.add('active');
}

Object.keys(daftarBasemap).forEach(key => {
  daftarBasemap[key].btn.addEventListener('click', () => gantiBasemap(key));
});

// ============================================================
// SKALA BATANG (built-in Leaflet)
// ============================================================
L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

// ============================================================
// TOGGLE SIDEBAR (biar peta bisa full-width)
// ============================================================
const sidebarEl = document.querySelector('.sidebar');
const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');

btnSidebarToggle.addEventListener('click', () => {
  const tersembunyi = sidebarEl.classList.toggle('collapsed');
  btnSidebarToggle.innerHTML = tersembunyi ? '&rsaquo;' : '&lsaquo;';
  btnSidebarToggle.title = tersembunyi ? 'Tampilkan panel' : 'Sembunyikan panel';
  // Tunggu transisi CSS (0.22s) kelar, baru suruh Leaflet hitung ulang
  // ukuran peta — kalau enggak, tile-nya gak nge-render penuh area barunya.
  setTimeout(() => map.invalidateSize(), 250);
});

// ============================================================
// KOORDINAT MOUSE
// ============================================================
const coordBox = document.getElementById('mouse-coord');
map.on('mousemove', (e) => {
  coordBox.textContent = `${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°`;
});

// ============================================================
// LOADING OVERLAY
// Dihitung berdasarkan jumlah fetch GeoJSON yang masih berjalan.
// Overlay baru hilang kalau SEMUA layer sudah selesai dicoba dimuat
// (berhasil ataupun gagal).
// ============================================================
let jumlahMuatBerjalan = 0;
const loadingOverlay = document.getElementById('loading-overlay');

function mulaiMuat() {
  jumlahMuatBerjalan++;
  loadingOverlay.classList.remove('hidden');
}

function selesaiMuat() {
  jumlahMuatBerjalan = Math.max(0, jumlahMuatBerjalan - 1);
  if (jumlahMuatBerjalan === 0) {
    loadingOverlay.classList.add('hidden');
  }
}

// ============================================================
// NOTIFIKASI (TOAST) UNTUK USER
// Dipakai terutama saat ada layer GeoJSON yang gagal dimuat, supaya
// tidak hanya tercatat di console.warn tapi juga kelihatan di UI.
// ============================================================
const notifContainer = document.getElementById('notif-container');

function tampilkanNotifikasi(pesan, tipe = 'error') {
  const el = document.createElement('div');
  el.className = `notif ${tipe === 'info' ? 'notif-info' : ''}`;
  el.innerHTML = `<span>${pesan}</span><button class="notif-close" aria-label="Tutup">&times;</button>`;
  el.querySelector('.notif-close').addEventListener('click', () => el.remove());
  notifContainer.appendChild(el);
  setTimeout(() => el.remove(), 7000);
}

// ============================================================
// HELPER FETCH GEOJSON TERPUSAT
// Membungkus fetch() supaya loading overlay & notifikasi error
// otomatis terpasang di setiap layer, tanpa menulis ulang boilerplate
// try/catch di setiap pemanggilan.
// ============================================================
function muatGeoJSON(url, namaLayer, onSukses) {
  mulaiMuat();
  return fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => onSukses(data))
    .catch(err => {
      console.warn(`Gagal load ${url}:`, err);
      tampilkanNotifikasi(`Layer "${namaLayer}" gagal dimuat dan tidak ditampilkan di peta.`);
    })
    .finally(() => selesaiMuat());
}

// ============================================================
// WARNA BERDASARKAN KATEGORI RISIKO
// ============================================================
function getColor(risk) {
  if (risk === 'Tinggi') return '#E24B4A';
  if (risk === 'Sedang') return '#BA7517';
  return '#639922';
}

function getRiskClass(risk) {
  if (risk === 'Tinggi') return 'risk-tinggi';
  if (risk === 'Sedang') return 'risk-sedang';
  return 'risk-rendah';
}

// ============================================================
// POPUP TABEL (dipakai oleh sumur, pipa, manifold)
// Sesuaikan nama field di sini kalau nama kolom GeoJSON kamu beda
// ============================================================
function getNamaObjek(properti) {
  return properti.WELL_ID || properti.ID_MAN || properti.MAN_ID || properti.Nama_Sumur || properti.NAMOBJ || null;
}

function buatPopup(properti) {
  const nama = getNamaObjek(properti) || 'Titik Infrastruktur';
  const risiko = properti.RISK_TYPE || '-';

  const jarakSungai = properti.NEAR_DIS_2;
  const jarakPemukiman = properti.NEAR_DIS_1;
  const jarakHutan = properti.NEAR_DIST;

  const katSungai = klasifikasiSatuFaktor(jarakSungai, 100, 150);
  const katPemukiman = klasifikasiSatuFaktor(jarakPemukiman, 250, 400);
  const katHutan = klasifikasiSatuFaktor(jarakHutan, 250, 400);

  const baris = (label, jarak, kategori) => {
    const teksJarak = jarak !== undefined && jarak !== null ? Math.round(jarak) + ' m' : '-';
    const teksKategori = kategori || '-';
    return `<tr>
      <td>${label}</td>
      <td>${teksJarak}<br><span class="popup-tag ${getRiskClass(kategori)}">${teksKategori}</span></td>
    </tr>`;
  };

  return `
    <div class="popup-header ${getRiskClass(risiko)}">${nama}</div>
    <table class="popup-table">
      <tr><td>Kategori Risiko Akhir</td><td><span class="popup-tag ${getRiskClass(risiko)}">${risiko}</span></td></tr>
      ${baris('Jarak ke Sungai', jarakSungai, katSungai)}
      ${baris('Jarak ke Pemukiman', jarakPemukiman, katPemukiman)}
      ${baris('Jarak ke Hutan', jarakHutan, katHutan)}
    </table>
    <button type="button" class="popup-download-btn">Unduh CSV &darr;</button>
  `;
}

// ============================================================
// VARIABEL PENAMPUNG LAYER
// ============================================================
let sumurLayer, pipaLayer, manifoldLayer;
let bufferSungaiLayer, bufferPemukimanLayer, bufferHutanLayer;
let sungaiLayer, pemukimanLayer, hutanLayer, jalanLayer, batasLayer;
let sumurDataGlobal = null; // dipakai untuk fitur search & statistik
let pipaDataGlobal = null;
let manifoldDataGlobal = null;

// Dipanggil tiap kali ada layer poligon (sungai/pemukiman/hutan/batas) yang
// baru selesai load & ditambahkan ke peta, supaya titik sumur & manifold
// tidak ketutup dan tetap bisa diklik.
function bawaTitikKeDepan() {
  if (sumurLayer) sumurLayer.bringToFront();
  if (manifoldLayer) manifoldLayer.bringToFront();
}

// ============================================================
// LOAD LAYER SUMUR
// ============================================================
muatGeoJSON('data/sumur.json', 'Sumur', (data) => {
  sumurDataGlobal = data;

  sumurLayer = L.geoJSON(data, {
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
      radius: 8,
      fillColor: getColor(feature.properties.RISK_TYPE),
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buatPopup(feature.properties));
      layer.on('popupopen', () => pasangTombolUnduhPopup(feature, 'Sumur'));
    }
  }).addTo(map);

  sumurLayer.bringToFront();
  recomputeStatistik();
});

// ============================================================
// LOAD LAYER JARINGAN PIPA
// ============================================================
muatGeoJSON('data/jaringan_pipa.json', 'Jaringan Pipa', (data) => {
  pipaDataGlobal = data;
  pipaLayer = L.geoJSON(data, {
    style: (feature) => ({ color: getColor(feature.properties.RISK_TYPE), weight: 3 }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buatPopup(feature.properties));
      layer.on('popupopen', () => pasangTombolUnduhPopup(feature, 'Jaringan Pipa'));
    }
  }).addTo(map);

  recomputeStatistik();
});

// ============================================================
// LOAD LAYER MANIFOLD
// ============================================================
muatGeoJSON('data/manifold.json', 'Manifold', (data) => {
  manifoldDataGlobal = data;
  manifoldLayer = L.geoJSON(data, {
    pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
      radius: 9,
      fillColor: getColor(feature.properties.RISK_TYPE),
      color: '#000',
      weight: 2,
      fillOpacity: 0.9
    }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(buatPopup(feature.properties));
      layer.on('popupopen', () => pasangTombolUnduhPopup(feature, 'Manifold'));
    }
  }).addTo(map);

  manifoldLayer.bringToFront();
  recomputeStatistik();
});

// ============================================================
// LOAD LAYER KAWASAN SENSITIF ASLI
// ============================================================
muatGeoJSON('data/sungai.json', 'Sungai', (data) => {
  sungaiLayer = L.geoJSON(data, { style: { color: '#00FFFF', weight: 2 } }).addTo(map);
  bawaTitikKeDepan();
});

muatGeoJSON('data/pemukiman.json', 'Pemukiman', (data) => {
  pemukimanLayer = L.geoJSON(data, { style: { color: '#2C2C2A', fillColor: '#FFD8B2', fillOpacity: 0.6, weight: 1 } }).addTo(map);
  bawaTitikKeDepan();
});

muatGeoJSON('data/hutan.json', 'Hutan', (data) => {
  hutanLayer = L.geoJSON(data, { style: { color: '#8FCF5C', fillColor: '#BFFF99', fillOpacity: 0.6, weight: 1 } }).addTo(map);
  bawaTitikKeDepan();
});

// ============================================================
// LOAD LAYER BUFFER
// ============================================================
muatGeoJSON('data/buffer_sungai.json', 'Buffer Sungai', (data) => {
  bufferSungaiLayer = L.geoJSON(data, { style: { color: '#00FFFF', fillColor: '#00FFFF', fillOpacity: 0.2, weight: 1 } });
});

muatGeoJSON('data/buffer_pemukiman.json', 'Buffer Pemukiman', (data) => {
  bufferPemukimanLayer = L.geoJSON(data, { style: { color: '#FFD8B2', fillColor: '#FFD8B2', fillOpacity: 0.35, weight: 1 } });
});

muatGeoJSON('data/buffer_hutan.json', 'Buffer Hutan', (data) => {
  bufferHutanLayer = L.geoJSON(data, { style: { color: '#BFFF99', fillColor: '#BFFF99', fillOpacity: 0.35, weight: 1 } });
});

// ============================================================
// LOAD LAYER KONTEKS (jalan, batas area studi)
// ============================================================
muatGeoJSON('data/jalan.json', 'Jalan', (data) => {
  jalanLayer = L.geoJSON(data, { style: { color: '#888780', weight: 1 } });
});

muatGeoJSON('data/batasan_area.json', 'Batas Area Studi', (data) => {
  batasLayer = L.geoJSON(data, { style: { color: '#2C2C2A', weight: 2, fillOpacity: 0, dashArray: '6 4' } }).addTo(map);
  map.fitBounds(batasLayer.getBounds());
  bawaTitikKeDepan();
});

// ============================================================
// KLASIFIKASI RISIKO DI SISI BROWSER
// (meniru logic Field Calculator yang dipakai di ArcMap,
// supaya bisa dihitung ulang dinamis sesuai layer yang aktif)
// ============================================================
function klasifikasiSatuFaktor(jarak, ambangTinggi, ambangSedang) {
  if (jarak === undefined || jarak === null) return null;
  if (jarak <= ambangTinggi) return 'Tinggi';
  if (jarak <= ambangSedang) return 'Sedang';
  return 'Rendah';
}

function hitungRisikoDinamis(properti, aktifHutan, aktifPemukiman, aktifSungai) {
  const hasil = [];

  if (aktifHutan) {
    const r = klasifikasiSatuFaktor(properti.NEAR_DIST, 250, 400);
    if (r) hasil.push(r);
  }
  if (aktifPemukiman) {
    const r = klasifikasiSatuFaktor(properti.NEAR_DIS_1, 250, 400);
    if (r) hasil.push(r);
  }
  if (aktifSungai) {
    const r = klasifikasiSatuFaktor(properti.NEAR_DIS_2, 100, 150);
    if (r) hasil.push(r);
  }

  if (hasil.length === 0) return null; // tidak ada faktor yang aktif
  if (hasil.includes('Tinggi')) return 'Tinggi';
  if (hasil.includes('Sedang')) return 'Sedang';
  return 'Rendah';
}

// ============================================================
// STATISTIK RISIKO
// Dihitung langsung dari field RISK_TYPE tiap fitur (sesuai tabel
// atribut/Excel sumber), bukan direkalkulasi dari jarak.
// Kartu besar & tabel rincian SAMA-SAMA menampilkan total dari
// seluruh data yang sudah termuat, tidak tergantung checkbox
// (checkbox Sumur/Pipa/Manifold/Kawasan Sensitif hanya mengatur
// tampil-tidaknya layer di peta, bukan angka statistik).
// ============================================================
function hitungRisikoUntukDataset(data) {
  const jumlah = { Tinggi: 0, Sedang: 0, Rendah: 0 };
  if (!data) return jumlah;
  data.features.forEach(f => {
    const kategori = f.properties.RISK_TYPE;
    if (kategori && Object.prototype.hasOwnProperty.call(jumlah, kategori)) {
      jumlah[kategori]++;
    }
  });
  return jumlah;
}

function isiSel(id, nilai) {
  const el = document.getElementById(id);
  if (el) el.textContent = nilai;
}

// ============================================================
// RINCIAN PER KAWASAN SENSITIF
// Beda dengan statistik total di atas (yang pakai RISK_TYPE final),
// bagian ini menjabarkan klasifikasi risiko per SATU kawasan sensitif
// saja (Sungai/Pemukiman/Hutan), dihitung langsung dari kolom jarak
// terkait, lalu dipecah per jenis infrastruktur. Tabelnya cuma
// muncul untuk kawasan yang checkbox-nya lagi dicentang di sidebar.
// ============================================================
const DAFTAR_KAWASAN_SENSITIF = [
  { idCheckbox: 'toggle-sungai', label: 'Sungai', field: 'NEAR_DIS_2', ambangTinggi: 100, ambangSedang: 150, swatchClass: 'swatch-sungai swatch-line' },
  { idCheckbox: 'toggle-pemukiman', label: 'Pemukiman', field: 'NEAR_DIS_1', ambangTinggi: 250, ambangSedang: 400, swatchClass: 'swatch-pemukiman' },
  { idCheckbox: 'toggle-hutan', label: 'Hutan', field: 'NEAR_DIST', ambangTinggi: 250, ambangSedang: 400, swatchClass: 'swatch-hutan' }
];

function hitungPerFaktor(data, field, ambangTinggi, ambangSedang) {
  const jumlah = { Tinggi: 0, Sedang: 0, Rendah: 0 };
  if (!data) return jumlah;
  data.features.forEach(f => {
    const kategori = klasifikasiSatuFaktor(f.properties[field], ambangTinggi, ambangSedang);
    if (kategori) jumlah[kategori]++;
  });
  return jumlah;
}

function buatBarisRincian(label, jumlah) {
  return `<tr>
    <td>${label}</td>
    <td>${jumlah.Tinggi}</td>
    <td>${jumlah.Sedang}</td>
    <td>${jumlah.Rendah}</td>
  </tr>`;
}

function renderRincianKawasan() {
  const container = document.getElementById('rincian-kawasan');
  if (!container) return;

  const aktif = DAFTAR_KAWASAN_SENSITIF.filter(k => {
    const cb = document.getElementById(k.idCheckbox);
    return cb && cb.checked;
  });

  if (aktif.length === 0) {
    container.innerHTML = '<p class="rincian-kawasan-empty">Centang salah satu kawasan di atas untuk lihat rincian risiko per kawasan, per infrastruktur.</p>';
    return;
  }

  container.innerHTML = aktif.map(k => {
    const jSumur = hitungPerFaktor(sumurDataGlobal, k.field, k.ambangTinggi, k.ambangSedang);
    const jPipa = hitungPerFaktor(pipaDataGlobal, k.field, k.ambangTinggi, k.ambangSedang);
    const jManifold = hitungPerFaktor(manifoldDataGlobal, k.field, k.ambangTinggi, k.ambangSedang);

    return `<div class="rincian-kawasan-block">
      <p class="rincian-kawasan-title"><span class="swatch ${k.swatchClass}"></span>${k.label}</p>
      <table class="breakdown-table">
        <thead><tr><th></th><th>Tinggi</th><th>Sedang</th><th>Rendah</th></tr></thead>
        <tbody>
          ${buatBarisRincian('Sumur', jSumur)}
          ${buatBarisRincian('Pipa', jPipa)}
          ${buatBarisRincian('Manifold', jManifold)}
        </tbody>
      </table>
    </div>`;
  }).join('');
}

function recomputeStatistik() {
  const jSumur = hitungRisikoUntukDataset(sumurDataGlobal);
  const jPipa = hitungRisikoUntukDataset(pipaDataGlobal);
  const jManifold = hitungRisikoUntukDataset(manifoldDataGlobal);

  // Total gabungan = seluruh data (Sumur + Pipa + Manifold), sama seperti
  // tabel rincian di bawahnya — tidak lagi tergantung checkbox.
  const total = { Tinggi: 0, Sedang: 0, Rendah: 0 };
  ['Tinggi', 'Sedang', 'Rendah'].forEach(k => {
    total[k] = jSumur[k] + jPipa[k] + jManifold[k];
  });

  isiSel('count-tinggi', total.Tinggi);
  isiSel('count-sedang', total.Sedang);
  isiSel('count-rendah', total.Rendah);

  // Tabel rincian per infrastruktur (selalu tampil sebagai pembanding)
  isiSel('bd-sumur-tinggi', jSumur.Tinggi);
  isiSel('bd-sumur-sedang', jSumur.Sedang);
  isiSel('bd-sumur-rendah', jSumur.Rendah);
  isiSel('bd-pipa-tinggi', jPipa.Tinggi);
  isiSel('bd-pipa-sedang', jPipa.Sedang);
  isiSel('bd-pipa-rendah', jPipa.Rendah);
  isiSel('bd-manifold-tinggi', jManifold.Tinggi);
  isiSel('bd-manifold-sedang', jManifold.Sedang);
  isiSel('bd-manifold-rendah', jManifold.Rendah);

  renderRincianKawasan();
}

// ============================================================
// TOGGLE LAYER LEWAT CHECKBOX SIDEBAR
// ============================================================
function pasangToggle(idCheckbox, getLayer) {
  document.getElementById(idCheckbox).addEventListener('change', (e) => {
    const layer = getLayer();
    if (!layer) return;
    if (e.target.checked) {
      map.addLayer(layer);
      // Pastikan titik sumur & manifold tetap bisa diklik, tidak tertutup poligon lain
      if (sumurLayer) sumurLayer.bringToFront();
      if (manifoldLayer) manifoldLayer.bringToFront();
    } else {
      map.removeLayer(layer);
    }
  });
}

pasangToggle('toggle-sumur', () => sumurLayer);
pasangToggle('toggle-pipa', () => pipaLayer);
pasangToggle('toggle-manifold', () => manifoldLayer);
pasangToggle('toggle-sungai', () => sungaiLayer);
pasangToggle('toggle-pemukiman', () => pemukimanLayer);
pasangToggle('toggle-hutan', () => hutanLayer);

// Statistik risiko dihitung ulang tiap kali salah satu dari 6 checkbox ini berubah
['toggle-sumur', 'toggle-pipa', 'toggle-manifold', 'toggle-sungai', 'toggle-pemukiman', 'toggle-hutan'].forEach(id => {
  document.getElementById(id).addEventListener('change', recomputeStatistik);
});
pasangToggle('toggle-buffer-sungai', () => bufferSungaiLayer);
pasangToggle('toggle-buffer-pemukiman', () => bufferPemukimanLayer);
pasangToggle('toggle-buffer-hutan', () => bufferHutanLayer);
pasangToggle('toggle-jalan', () => jalanLayer);
pasangToggle('toggle-batas', () => batasLayer);

// ============================================================
// SEARCH SUMUR + ZOOM SAAT DIPILIH
// ============================================================
const searchInput = document.getElementById('search-sumur');
const searchResults = document.getElementById('search-results');

searchInput.addEventListener('input', () => {
  const kata = searchInput.value.trim().toLowerCase();
  searchResults.innerHTML = '';

  if (kata.length === 0) {
    searchResults.classList.add('hidden');
    return;
  }

  if (!sumurDataGlobal) {
    searchResults.innerHTML = '<div class="search-result-item">Data sumur belum dimuat...</div>';
    searchResults.classList.remove('hidden');
    return;
  }

  const cocok = sumurDataGlobal.features.filter(f => {
    const id = String(getNamaObjek(f.properties) || '').trim().toLowerCase();
    return id.includes(kata);
  });

  if (cocok.length === 0) {
    searchResults.innerHTML = '<div class="search-result-item">Tidak ditemukan</div>';
    searchResults.classList.remove('hidden');
    return;
  }

  cocok.forEach(f => {
    const namaObjek = getNamaObjek(f.properties);
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.textContent = namaObjek || 'Tanpa nama';
    div.addEventListener('click', () => {
      const koordinat = f.geometry.coordinates; // [lng, lat]
      map.setView([koordinat[1], koordinat[0]], 18);

      // Buka popup titik yang dipilih
      sumurLayer.eachLayer(layer => {
        if (getNamaObjek(layer.feature.properties) === namaObjek) {
          layer.openPopup();
        }
      });

      searchResults.classList.add('hidden');
      searchInput.value = namaObjek;
    });
    searchResults.appendChild(div);
  });

  searchResults.classList.remove('hidden');
});

// Tutup dropdown hasil search kalau klik di luar area search
document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
    searchResults.classList.add('hidden');
  }
});

// ============================================================
// CETAK PDF (dipanggil lewat Ctrl+P / menu print browser)
// Tombol khusus di UI sudah dihapus, tapi styling @media print
// tetap aktif kalau user mencetak lewat cara bawaan browser.
// Untuk hasil lebih rapi, pertimbangkan pakai library
// leaflet-easyPrint atau html2canvas + jsPDF
// ============================================================
// Isi tanggal cetak otomatis tepat sebelum dialog print muncul
window.addEventListener('beforeprint', () => {
  const el = document.getElementById('print-date');
  if (el) {
    el.textContent = 'Dicetak pada: ' + new Date().toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }
});

// ============================================================
// PANEL METADATA (INFO)
// ============================================================
const infoPanel = document.getElementById('info-panel');
const btnInfo = document.getElementById('btn-info');

btnInfo.addEventListener('click', () => {
  infoPanel.classList.toggle('hidden');
  btnInfo.classList.toggle('active');
});

document.getElementById('info-panel-close').addEventListener('click', () => {
  infoPanel.classList.add('hidden');
  btnInfo.classList.remove('active');
});

// ============================================================
// FULLSCREEN
// ============================================================
const btnFullscreen = document.getElementById('btn-fullscreen');
const elemDashboard = document.querySelector('.dashboard');

btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    elemDashboard.requestFullscreen().catch(err => {
      tampilkanNotifikasi('Browser tidak mengizinkan mode layar penuh.');
      console.warn(err);
    });
  } else {
    document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  btnFullscreen.classList.toggle('active', !!document.fullscreenElement);
  // Leaflet perlu tahu ukuran container berubah setelah transisi fullscreen
  setTimeout(() => map.invalidateSize(), 150);
});

// ============================================================
// EXPORT DATA (CSV) — hasil klasifikasi risiko seluruh infrastruktur
// ============================================================
function barisCSV(data, jenis) {
  if (!data) return [];
  return data.features.map(f => {
    const p = f.properties;
    const nama = getNamaObjek(p) || '-';
    let lat = '', lng = '';
    if (f.geometry && f.geometry.type === 'Point') {
      lng = f.geometry.coordinates[0];
      lat = f.geometry.coordinates[1];
    }
    return [
      jenis,
      nama,
      p.RISK_TYPE || '-',
      p.NEAR_DIS_2 ?? '',
      p.NEAR_DIS_1 ?? '',
      p.NEAR_DIST ?? '',
      lat,
      lng
    ];
  });
}

function escapeCSV(nilai) {
  const s = String(nilai);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ============================================================
// EXPORT DATA (CSV) — SATU TITIK SAJA, dari tombol di dalam popup
// ============================================================
function unduhSatuTitik(feature, jenis) {
  const p = feature.properties;
  const nama = getNamaObjek(p) || 'titik';

  let lat = '', lng = '';
  if (feature.geometry && feature.geometry.type === 'Point') {
    lng = feature.geometry.coordinates[0];
    lat = feature.geometry.coordinates[1];
  }

  const header = ['Jenis Infrastruktur', 'Nama/ID', 'Kategori Risiko', 'Jarak ke Sungai (m)', 'Jarak ke Pemukiman (m)', 'Jarak ke Hutan (m)', 'Latitude', 'Longitude'];
  const row = [jenis, nama, p.RISK_TYPE || '-', p.NEAR_DIS_2 ?? '', p.NEAR_DIS_1 ?? '', p.NEAR_DIST ?? '', lat, lng];

  const csvContent = [header, row].map(baris => baris.map(escapeCSV).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const namaFile = `${jenis}-${nama}.csv`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  tampilkanNotifikasi(`Data ${nama} berhasil diunduh.`, 'info');
}

// Dipanggil tiap popup dibuka, supaya tombol "Unduh CSV Titik Ini" di
// dalamnya benar-benar berfungsi (karena kontennya di-generate ulang
// sebagai HTML string tiap kali, elemen tombolnya juga baru tiap saat).
function pasangTombolUnduhPopup(feature, jenis) {
  const tombol = document.querySelector('.leaflet-popup-content .popup-download-btn');
  if (tombol) {
    tombol.onclick = () => unduhSatuTitik(feature, jenis);
  }
}

document.getElementById('btn-export').addEventListener('click', () => {
  if (!sumurDataGlobal && !pipaDataGlobal && !manifoldDataGlobal) {
    tampilkanNotifikasi('Data belum selesai dimuat, coba beberapa saat lagi.');
    return;
  }

  const header = ['Jenis Infrastruktur', 'Nama/ID', 'Kategori Risiko', 'Jarak ke Sungai (m)', 'Jarak ke Pemukiman (m)', 'Jarak ke Hutan (m)', 'Latitude', 'Longitude'];
  const rows = [
    header,
    ...barisCSV(sumurDataGlobal, 'Sumur'),
    ...barisCSV(pipaDataGlobal, 'Pipa'),
    ...barisCSV(manifoldDataGlobal, 'Manifold')
  ];

  const csvContent = rows.map(baris => baris.map(escapeCSV).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const tanggal = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `klasifikasi-risiko-migas-${tanggal}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  tampilkanNotifikasi('Data klasifikasi risiko berhasil diunduh sebagai CSV.', 'info');
});

// ============================================================
// RESET TAMPILAN PETA
// Balikin peta ke extent awal (batas area studi kalau sudah termuat,
// atau pusat+zoom default kalau belum).
// ============================================================
const btnReset = document.getElementById('btn-reset');

btnReset.addEventListener('click', () => {
  if (batasLayer) {
    map.fitBounds(batasLayer.getBounds());
  } else {
    map.setView(PUSAT_PETA, ZOOM_AWAL);
  }
});