const regionalMap = {
    "reg1": { name: "Irfan Baharudin", title: "Regional Head 1", email: "irfan.baharudin@jba.co.id" },
    "reg2": { name: "Syafi Munawir Almaki", title: "Regional Head 2", email: "syafi.almaki@jba.co.id" },
    "reg3": { name: "Tan Hung Pau", title: "Regional Head 3 & 4", email: "tan.pau@jba.co.id" }
};

const subRegionalMap = {
    "sub1": { name: "Abdul Rozzaq", title: "Sub Regional Head", email: "abdul.rozzaq@jba.co.id" },
    "sub2": { name: "Isna Novaliany", title: "Sub Regional Head", email: "isna.novaliany@jba.co.id" },
    "sub3": { name: "Arkan Muharram Mahadika", title: "Sub Regional Head", email: "arkan.mahadika@jba.co.id" },
    "sub4": { name: "Alit Pamrihnan", title: "Sub Regional Head", email: "alit.pamrihnan@jba.co.id" }
};

// Daftar email yang berhak melakukan Approval (Admin & Manager ke atas)
const listAdminManagerEmails = [
    'ahmad.shobri@jba.co.id',
    'manager@jba.co.id',
    'head@jba.co.id'
];

function toRoman(num) {
    const romanMap = [
        { val: 12, str: "XII" }, { val: 11, str: "XI" }, { val: 10, str: "X" },
        { val: 9, str: "IX" }, { val: 8, str: "VIII" }, { val: 7, str: "VII" },
        { val: 6, str: "VI" }, { val: 5, str: "V" }, { val: 4, str: "IV" },
        { val: 3, str: "III" }, { val: 2, str: "II" }, { val: 1, str: "I" }
    ];
    const found = romanMap.find(x => x.val === num);
    return found ? found.str : "I";
}

function formatIndonesianDate(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return "-";
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

let dbPenomoran = [];
let auditDatabase = [];
let fraudDatabase = [];
let activityLogs = [];
let currentUserEmail = "";
let currentUserRole = "auditor"; // auditor | manager

function isHighPrivilegeUser() {
    return currentUserRole === "admin" || currentUserRole === "manager";
}

function canUserEditProject(docCreatedBy) {
    if (isHighPrivilegeUser()) return true;
    if (!docCreatedBy || !currentUserEmail) return false;
    return docCreatedBy.toLowerCase() === currentUserEmail.toLowerCase();
}

// Referensi jendela pop-up detail yang aktif
let currentDetailWindow = null;

// State Sorting Penomoran
let currentSortColumn = 'noSPP';
let currentSortDirection = 'desc';

// State Sorting Summary Audit
let summarySortColumn = 'noSPP';
let summarySortDirection = 'asc';

function logActivity(kategori, aktivitas, detailDoc, status = "Success") {
    const newLog = {
        id: Date.now(),
        timestamp: new Date().toLocaleString('id-ID'),
        userEmail: currentUserEmail || "System/Guest",
        kategori: kategori,
        aktivitas: aktivitas,
        detailDoc: detailDoc,
        status: status
    };
    activityLogs.unshift(newLog);
    if (typeof database !== 'undefined' && database && database.ref) {
        database.ref('activityLogs').set(activityLogs);
    }
}

function syncPenomoranToFirebase() {
    if (typeof database !== 'undefined' && database && database.ref) {
        database.ref('dbPenomoran').set(dbPenomoran);
    }
}

function syncAuditDbToFirebase() {
    if (typeof database !== 'undefined' && database && database.ref) {
        database.ref('auditDatabase').set(auditDatabase);
    }
}

function syncFraudDbToFirebase() {
    if (typeof database !== 'undefined' && database && database.ref) {
        database.ref('fraudDatabase').set(fraudDatabase);
    }
}

function switchTab(tabId, evt) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active', 'active-fraud', 'active-log'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if(evt && evt.target) {
        if(tabId === 'tab-antifraud') evt.target.classList.add('active-fraud');
        else if(tabId === 'tab-activitylog') evt.target.classList.add('active-log');
        else evt.target.classList.add('active');
    }
    document.getElementById(tabId).classList.add('active');
    refreshUI();
}

function toggleBackDateFields() {
    const isChecked = document.getElementById('p-is-backdate').checked;
    document.getElementById('backdate-fields').style.display = isChecked ? 'block' : 'none';
    updateSPPPreview();
}

function getNextSPPSequence(targetYear, targetJenis) {
    const listInYearAndType = dbPenomoran.filter(d => 
        d && 
        typeof d === 'object' && 
        Number(d.year) === Number(targetYear) && 
        d.jenis === targetJenis
    );
    
    if (listInYearAndType.length === 0) return 1;

    const existingSeqs = new Set();
    listInYearAndType.forEach(d => {
        let seq = 0;
        if (typeof d.sppSeq === 'number' && !isNaN(d.sppSeq)) {
            seq = d.sppSeq;
        } else {
            const strVal = String(d.sppSeq || d.noSPP || '');
            const match = strVal.match(/^(\d+)/);
            if (match) seq = parseInt(match[1], 10);
        }
        if (seq > 0) existingSeqs.add(seq);
    });

    let nextSeq = 1;
    while (existingSeqs.has(nextSeq)) {
        nextSeq++;
    }

    return nextSeq;
}

function getNextLHASequence(targetYear) {
    const listInYear = dbPenomoran.filter(d => d && Number(d.year) === Number(targetYear) && d.lhaSeq);
    if (listInYear.length === 0) return 1;

    const existingSeqs = new Set(listInYear.map(d => Number(d.lhaSeq)).filter(num => !isNaN(num) && num > 0));
    let nextSeq = 1;
    while (existingSeqs.has(nextSeq)) {
        nextSeq++;
    }
    return nextSeq;
}

function getNextPICASequence(targetYear) {
    const listInYear = dbPenomoran.filter(d => d && Number(d.year) === Number(targetYear) && d.picaSeq);
    if (listInYear.length === 0) return 1;

    const existingSeqs = new Set(listInYear.map(d => Number(d.picaSeq)).filter(num => !isNaN(num) && num > 0));
    let nextSeq = 1;
    while (existingSeqs.has(nextSeq)) {
        nextSeq++;
    }
    return nextSeq;
}

function updateSPPPreview() {
    const editId = document.getElementById('edit-doc-id').value;
    if (editId) return;

    const jenis = document.getElementById('p-jenis').value;
    const tglMulai = document.getElementById('p-tgl-mulai').value;
    const isBackdate = document.getElementById('p-is-backdate').checked;
    const manualSeqVal = document.getElementById('p-manual-spp-seq').value;

    const tglTerbitEl = document.getElementById('p-tgl-terbit');
    const tglTerbitVal = tglTerbitEl ? tglTerbitEl.value : '';
    const dateObj = tglTerbitVal ? new Date(tglTerbitVal) : (tglMulai ? new Date(tglMulai) : new Date());

    const targetYear = dateObj.getFullYear();
    const monthRoman = toRoman(dateObj.getMonth() + 1);

    let targetSeq = (isBackdate && manualSeqVal) ? parseInt(manualSeqVal, 10) : getNextSPPSequence(targetYear, jenis);
    const seqStr = String(targetSeq).padStart(3, '0');

    let previewSPP = "";
    if (jenis === "Investigasi") previewSPP = `${seqStr}/FOC-SRT TUGAS/${monthRoman}/${targetYear}`;
    else if (jenis === "Adhoc") previewSPP = `${seqStr}/SPP-ADH/JBA-IA/${monthRoman}/${targetYear}`;
    else if (jenis === "Advisory") previewSPP = `${seqStr}/SPP-ADV/JBA-IA/${monthRoman}/${targetYear}`;
    else previewSPP = `${seqStr}/SPP/JBA-IA/${monthRoman}/${targetYear}`;

    document.getElementById('live-spp-preview').innerText = previewSPP;
}

function generateDocumentNumber(e) {
    if (e && e.preventDefault) e.preventDefault();

    const editId = document.getElementById('edit-doc-id').value;
    const jenis = document.getElementById('p-jenis').value;
    const judul = document.getElementById('p-judul').value;
    
    // Regional Head Data
    const regKey = document.getElementById('p-regional').value;
    const regionalHead = regionalMap[regKey].name;
    const jabatanRegionalHead = regionalMap[regKey].title;
    const emailRegionalHead = regionalMap[regKey].email;

    // Sub Regional Head Data (Opsional)
    const subRegKey = document.getElementById('p-sub-regional').value;
    const subRegionalHead = subRegKey && subRegionalMap[subRegKey] ? subRegionalMap[subRegKey].name : "";
    const emailSubRegional = subRegKey && subRegionalMap[subRegKey] ? subRegionalMap[subRegKey].email : "";

    // Nama & Email Kepala Pool Baru
    const namaKepalaPool = document.getElementById('p-nama-kepala-pool').value;
    const emailKepalaPool = document.getElementById('p-email-kepala-pool').value;

    const periode = document.getElementById('p-periode').value;
    const tglMulai = document.getElementById('p-tgl-mulai').value;
    const tglSelesai = document.getElementById('p-tgl-selesai').value;
    const tglPemeriksaanFormatted = `${formatIndonesianDate(new Date(tglMulai))} s.d ${formatIndonesianDate(new Date(tglSelesai))}`;

    const auditor = document.getElementById('p-auditor').value;
    const m1 = document.getElementById('p-member1').value;
    const m2 = document.getElementById('p-member2').value;
    const auditMembers = [m1, m2].filter(x => x.trim() !== "").join(", ") || "-";

    const isBackdate = document.getElementById('p-is-backdate').checked;
    const manualSeqVal = document.getElementById('p-manual-spp-seq').value;

    const tglTerbitEl = document.getElementById('p-tgl-terbit');
    const tglTerbitVal = tglTerbitEl ? tglTerbitEl.value : '';
    const dateObj = tglTerbitVal ? new Date(tglTerbitVal) : new Date(tglMulai);
    const targetYear = dateObj.getFullYear();
    const monthRoman = toRoman(dateObj.getMonth() + 1);
    const tglTerbitFormatted = formatIndonesianDate(dateObj);

    if (editId) {
        const docIdx = dbPenomoran.findIndex(x => x.id == editId);
        if (docIdx !== -1) {
            const currentDoc = dbPenomoran[docIdx];
            let newSPP = document.getElementById('edit-manual-spp-val').value.trim() || currentDoc.noSPP;

            dbPenomoran[docIdx] = {
                ...currentDoc,
                jenis: jenis,
                noSPP: newSPP,
                tanggalStart: tglTerbitFormatted,
                judul: judul,
                regionalHead: regionalHead,
                jabatanRegionalHead: jabatanRegionalHead,
                emailRegionalHead: emailRegionalHead,
                subRegionalHead: subRegionalHead,
                emailSubRegional: emailSubRegional,
                namaKepalaPool: namaKepalaPool,
                emailKepalaPool: emailKepalaPool,
                periodeAudit: periode,
                tglMulai: tglMulai,
                tglSelesai: tglSelesai,
                tglPelaksanaan: tglPemeriksaanFormatted,
                auditor: auditor,
                auditMembers: auditMembers,
                updated_by: currentUserEmail
            };

            logActivity("Penomoran Dokumen", "Revisi / Edit Project", newSPP);
            alert("Data Penomoran Project Berhasil Diperbarui!");
        }
    } else {
        let seqNum = (isBackdate && manualSeqVal) ? parseInt(manualSeqVal, 10) : getNextSPPSequence(targetYear, jenis);
        const seqStr = String(seqNum).padStart(3, '0');

        let autoSPP = "";
        if (jenis === "Investigasi") autoSPP = `${seqStr}/FOC-SRT TUGAS/${monthRoman}/${targetYear}`;
        else if (jenis === "Adhoc") autoSPP = `${seqStr}/SPP-ADH/JBA-IA/${monthRoman}/${targetYear}`;
        else if (jenis === "Advisory") autoSPP = `${seqStr}/SPP-ADV/JBA-IA/${monthRoman}/${targetYear}`;
        else autoSPP = `${seqStr}/SPP/JBA-IA/${monthRoman}/${targetYear}`;

        const newDoc = {
            id: Date.now(),
            jenis: jenis,
            year: targetYear,
            sppSeq: seqNum,
            noSPP: autoSPP,
            lhaSeq: null,
            noLHA: "-",
            picaSeq: null,
            noPICA: "-",
            tanggalStart: tglTerbitFormatted,
            tglMulai: tglMulai,
            tglSelesai: tglSelesai,
            tglPelaksanaan: tglPemeriksaanFormatted,
            judul: judul,
            regionalHead: regionalHead,
            jabatanRegionalHead: jabatanRegionalHead,
            emailRegionalHead: emailRegionalHead,
            subRegionalHead: subRegionalHead,
            emailSubRegional: emailSubRegional,
            namaKepalaPool: namaKepalaPool,
            emailKepalaPool: emailKepalaPool,
            periodeAudit: periode,
            auditor: auditor,
            auditMembers: auditMembers,
            hasSignedSPP: false,
            created_by: currentUserEmail,
            statusManager: "Not Approved",
            isBackdate: isBackdate
        };

        dbPenomoran.push(newDoc);
        logActivity("Penomoran Dokumen", `Penerbitan Nomor (${isBackdate ? 'Back Date' : 'Otomatis'})`, autoSPP);
        alert(`Nomor Dokumen ${jenis} Berhasil Diterbitkan!\nNo. Surat: ${autoSPP}`);
    }

    syncPenomoranToFirebase();
    resetPenomoranForm();
    populateDropdowns();
    refreshUI();
}

function editDocumentNumber(id) {
    const doc = dbPenomoran.find(x => x.id === id);
    if (!doc) return;

    document.getElementById('edit-doc-id').value = doc.id;
    
    document.getElementById('p-jenis').value = doc.jenis || "Reguler";
    document.getElementById('p-judul').value = doc.judul || "";
    document.getElementById('p-periode').value = doc.periodeAudit || "";
    document.getElementById('p-auditor').value = doc.auditor || "";
    
    // Set Nama & Email Kepala Pool
    document.getElementById('p-nama-kepala-pool').value = doc.namaKepalaPool || "";
    document.getElementById('p-email-kepala-pool').value = doc.emailKepalaPool || "";

    const regEntry = Object.entries(regionalMap).find(([_, v]) => v.name === doc.regionalHead);
    if (regEntry) document.getElementById('p-regional').value = regEntry[0];

    const subRegEntry = Object.entries(subRegionalMap).find(([_, v]) => v.name === doc.subRegionalHead);
    if (subRegEntry) document.getElementById('p-sub-regional').value = subRegEntry[0];
    
    if (doc.tglMulai) document.getElementById('p-tgl-mulai').value = doc.tglMulai;
    if (doc.tglSelesai) document.getElementById('p-tgl-selesai').value = doc.tglSelesai;

    const elTglTerbit = document.getElementById('p-tgl-terbit');
    if (elTglTerbit && doc.tglMulai) {
        elTglTerbit.value = doc.tglMulai;
    }

    const members = (doc.auditMembers || '').split(', ');
    document.getElementById('p-member1').value = members[0] || '';
    document.getElementById('p-member2').value = members[1] || '';

    document.getElementById('container-edit-manual-spp').style.display = "block";
    document.getElementById('edit-manual-spp-val').value = doc.noSPP;
    
    document.getElementById('container-live-spp-preview').style.display = "none";
    document.getElementById('container-backdate-toggle').style.display = "none";

    if (doc.statusManager === "Approved by Manager") {
        document.getElementById('container-edit-manual-approved').style.display = "block";
        document.getElementById('edit-manual-lha').value = doc.noLHA || "";
        document.getElementById('edit-manual-pica').value = doc.noPICA || "";
    } else {
        document.getElementById('container-edit-manual-approved').style.display = "none";
    }

    document.getElementById('form-penomoran-title').innerText = "⚙️ Edit Project & Penomoran Dokumen";
    document.getElementById('btn-submit-penomoran').innerText = "💾 Simpan Perubahan";
    document.getElementById('btn-cancel-edit').style.display = "block";

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteDocumentNumber(id) {
    const doc = dbPenomoran.find(x => x.id === id);
    if (!doc) return;

    if (confirm(`Apakah Anda yakin ingin MENGHAPUS PERMANEN nomor SPP berikut?\n\nNo. SPP: ${doc.noSPP}\nJudul: ${doc.judul}`)) {
        dbPenomoran = dbPenomoran.filter(item => item.id !== id);

        syncPenomoranToFirebase();

        logActivity("Penomoran Dokumen", "Hapus Permanen Nomor SPP", doc.noSPP);
        populateDropdowns();
        refreshUI();
        alert(`🗑️ Nomor SPP (${doc.noSPP}) berhasil dihapus permanen!`);
    }
}

function resetPenomoranForm() {
    document.getElementById('form-penomoran').reset();
    document.getElementById('edit-doc-id').value = "";
    document.getElementById('p-is-backdate').checked = false;
    document.getElementById('container-edit-manual-spp').style.display = "none";
    document.getElementById('container-edit-manual-approved').style.display = "none";
    document.getElementById('container-live-spp-preview').style.display = "block";
    document.getElementById('container-backdate-toggle').style.display = "block";
    
    const elTglTerbit = document.getElementById('p-tgl-terbit');
    if (elTglTerbit) {
        elTglTerbit.value = new Date().toISOString().slice(0, 10);
    }

    toggleBackDateFields();

    document.getElementById('form-penomoran-title').innerText = "Form Penomoran Dokumen & Surat Tugas";
    document.getElementById('btn-submit-penomoran').innerText = "⚡ Generate Nomor Dokumen";
    document.getElementById('btn-cancel-edit').style.display = "none";
    updateSPPPreview();
}

function openUploadSppModal(id) {
    document.getElementById('modal-spp-doc-id').value = id;
    document.getElementById('modal-spp-file').value = "";
    document.getElementById('modal-upload-spp').style.display = 'flex';
}

function closeUploadSppModal() {
    document.getElementById('modal-upload-spp').style.display = 'none';
}

function submitUploadSppSigned() {
    const id = document.getElementById('modal-spp-doc-id').value;
    const fileInput = document.getElementById('modal-spp-file');
    if (!fileInput.files || fileInput.files.length === 0) {
        return alert("Pilih berkas Surat Tugas yang sudah ditandatangani basah!");
    }

    const doc = dbPenomoran.find(x => x.id == id);
    if (doc) {
        doc.hasSignedSPP = true;
        syncPenomoranToFirebase();
        logActivity("Penomoran Dokumen", "Upload SPP Tanda Tangan Basah", doc.noSPP);
        closeUploadSppModal();
        refreshUI();
        alert("Surat Tugas bertanda tangan basah berhasil di-submit!");
    }
}

function sendSignedSPP_Email(id) {
    const doc = dbPenomoran.find(x => x.id === id);
    if (!doc) return;

    // Email Auditee Utama (TO)
    let toEmail = doc.emailRegionalHead || "regional.head@jba.co.id";
    
    // Logika Email CC
    let ccList = [];
    if (doc.emailSubRegional && doc.emailSubRegional.trim() !== "") {
        ccList.push(doc.emailSubRegional);
    }
    if (doc.emailKepalaPool && doc.emailKepalaPool.trim() !== "") {
        ccList.push(doc.emailKepalaPool);
    }
    let ccEmail = ccList.join(", ");

    // Format Tanggal Mulai Audit
    const tglMulaiFormatted = doc.tglMulai 
        ? formatIndonesianDate(new Date(doc.tglMulai)) 
        : "-";

    // Format Tanggal Hari Ini (Tanggal Kirim Email)
    const tglKirimFormatted = formatIndonesianDate(new Date());

    let subject = encodeURIComponent(`[SURAT PENUGASAN INTERNAL AUDIT] ${doc.judul} - ${doc.noSPP}`);
    let body = encodeURIComponent(
        `Dear Bapak ${doc.regionalHead || '-'},\n\n` +
        `Sesuai dengan arahan manajemen terkait pelaksanaan audit rutin tahunan, kami dari Tim Audit akan melakukan audit di seluruh pool JBA sesuai dengan surat tugas terlampir.\n` +
        `Pelaksanaan audit telah dimulai pada tanggal ${tglMulaiFormatted} melalui proses profiling di Head Office, di mana tim audit akan melakukan analisis dan pemeriksaan dokumen sebagai bagian dari proses audit.\n` +
        `Selanjutnya, kunjungan ke pool akan dilaksanakan mulai ${tglKirimFormatted} hingga selesai.\n\n` +
        `Mohon dukungan dan kerja sama dari Bapak beserta tim selama proses audit berlangsung agar pelaksanaan audit dapat berjalan dengan lancar dan sesuai dengan rencana\n\n\n` +
        `Demikian disampaikan. Terima kasih.\n` +
        `Internal Audit Department`
    );

    let mailtoUrl = `mailto:${toEmail}?subject=${subject}&body=${body}`;
    if (ccEmail.trim() !== "") {
        mailtoUrl += `&cc=${encodeURIComponent(ccEmail)}`;
    }

    logActivity("Penomoran Dokumen", "Pengiriman Email Surat Tugas (Outlook)", doc.noSPP);

    window.location.href = mailtoUrl;
}

function sortByColumn(columnName) {
    if (currentSortColumn === columnName) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = columnName;
        currentSortDirection = 'asc';
    }
    
    document.querySelectorAll('.sort-icon').forEach(el => el.innerText = '⇅');
    const activeIcon = document.getElementById(`sort-icon-${columnName}`);
    if (activeIcon) {
        activeIcon.innerText = currentSortDirection === 'asc' ? '▲' : '▼';
    }

    applyExcelFilters();
}

function updateExcelFilterDropdowns() {
    const auditors = [...new Set(dbPenomoran.map(x => x.auditor).filter(Boolean))].sort();
    const selAuditor = document.getElementById('filter-excel-auditor');
    if (selAuditor) {
        const currentVal = selAuditor.value;
        selAuditor.innerHTML = `<option value="">-- All Lead Auditor --</option>` + 
            auditors.map(a => `<option value="${a}" ${a === currentVal ? 'selected' : ''}>${a}</option>`).join('');
    }

    const jenisList = [...new Set(dbPenomoran.map(x => x.jenis).filter(Boolean))].sort();
    const selJenis = document.getElementById('filter-excel-jenis');
    if (selJenis) {
        const currentVal = selJenis.value;
        selJenis.innerHTML = `<option value="">-- All Jenis --</option>` + 
            jenisList.map(j => `<option value="${j}" ${j === currentVal ? 'selected' : ''}>${j}</option>`).join('');
    }

    const regList = [...new Set(dbPenomoran.map(x => x.regionalHead).filter(Boolean))].sort();
    const selRegional = document.getElementById('filter-excel-regional');
    if (selRegional) {
        const currentVal = selRegional.value;
        selRegional.innerHTML = `<option value="">-- All Regional Head --</option>` + 
            regList.map(r => `<option value="${r}" ${r === currentVal ? 'selected' : ''}>${r}</option>`).join('');
    }
}

function applyExcelFilters() {
    const globalQuery = (document.getElementById('search-penomoran').value || '').toLowerCase().trim();
    const selectedJenis = document.getElementById('filter-excel-jenis').value;
    const selectedAuditor = document.getElementById('filter-excel-auditor').value;
    const selectedRegional = document.getElementById('filter-excel-regional').value;

    let filtered = dbPenomoran.filter(item => {
        const matchGlobal = !globalQuery || 
            (item.jenis && item.jenis.toLowerCase().includes(globalQuery)) ||
            (item.noSPP && item.noSPP.toLowerCase().includes(globalQuery)) ||
            (item.noLHA && item.noLHA.toLowerCase().includes(globalQuery)) ||
            (item.noPICA && item.noPICA.toLowerCase().includes(globalQuery)) ||
            (item.judul && item.judul.toLowerCase().includes(globalQuery)) ||
            (item.auditor && item.auditor.toLowerCase().includes(globalQuery)) ||
            (item.regionalHead && item.regionalHead.toLowerCase().includes(globalQuery)) ||
            (item.periodeAudit && item.periodeAudit.toLowerCase().includes(globalQuery));

        const matchJenis = !selectedJenis || item.jenis === selectedJenis;
        const matchAuditor = !selectedAuditor || item.auditor === selectedAuditor;
        const matchRegional = !selectedRegional || item.regionalHead === selectedRegional;

        return matchGlobal && matchJenis && matchAuditor && matchRegional;
    });

    filtered.sort((a, b) => {
        let valA = a[currentSortColumn] || '';
        let valB = b[currentSortColumn] || '';

        if (currentSortColumn === 'noSPP' || currentSortColumn === 'noLHA' || currentSortColumn === 'noPICA') {
            const extractNum = (str) => {
                const match = String(str).match(/^(\d+)\//);
                return match ? parseInt(match[1], 10) : 0;
            };
            valA = extractNum(valA);
            valB = extractNum(valB);
        } else if (currentSortColumn === 'tglSelesai') {
            valA = new Date(a.tglSelesai || 0).getTime() || 0;
            valB = new Date(b.tglSelesai || 0).getTime() || 0;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    renderPenomoranRows(filtered);
}

function resetExcelFilters() {
    document.getElementById('search-penomoran').value = '';
    document.getElementById('filter-excel-jenis').value = '';
    document.getElementById('filter-excel-auditor').value = '';
    document.getElementById('filter-excel-regional').value = '';
    currentSortColumn = 'noSPP';
    currentSortDirection = 'desc';
    
    document.querySelectorAll('.sort-icon').forEach(el => el.innerText = '⇅');
    applyExcelFilters();
}

function sortSummaryByColumn(col) {
    if (summarySortColumn === col) {
        summarySortDirection = summarySortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        summarySortColumn = col;
        summarySortDirection = 'asc';
    }

    document.querySelectorAll('#tab-audit .sort-icon').forEach(el => el.innerText = '⇅');
    const activeIcon = document.getElementById(`sort-summary-${col}`);
    if (activeIcon) activeIcon.innerText = summarySortDirection === 'asc' ? '▲' : '▼';

    applySummaryAuditFilters();
}

function applySummaryAuditFilters() {
    const searchVal = (document.getElementById('search-audit-summary').value || '').toLowerCase().trim();
    const selectedAuditor = document.getElementById('filter-audit-auditor').value;

    let list = dbPenomoran.filter(x => x.jenis !== 'Investigasi');

    let filtered = list.filter(item => {
        const matchSearch = !searchVal || 
            (item.noSPP && item.noSPP.toLowerCase().includes(searchVal)) ||
            (item.noLHA && item.noLHA.toLowerCase().includes(searchVal)) ||
            (item.noPICA && item.noPICA.toLowerCase().includes(searchVal)) ||
            (item.judul && item.judul.toLowerCase().includes(searchVal)) ||
            (item.auditor && item.auditor.toLowerCase().includes(searchVal));

        const matchAuditor = !selectedAuditor || item.auditor === selectedAuditor;

        return matchSearch && matchAuditor;
    });

    filtered.sort((a, b) => {
        let valA = a[summarySortColumn] || '';
        let valB = b[summarySortColumn] || '';

        if (['noSPP', 'noLHA', 'noPICA'].includes(summarySortColumn)) {
            const extractNum = (str) => {
                const match = String(str).match(/^(\d+)\//);
                return match ? parseInt(match[1], 10) : 0;
            };
            valA = extractNum(valA);
            valB = extractNum(valB);
        } else if (summarySortColumn === 'tglSelesai') {
            valA = new Date(a.tglSelesai || 0).getTime() || 0;
            valB = new Date(b.tglSelesai || 0).getTime() || 0;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return summarySortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return summarySortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    renderAuditSummaryRows(filtered);
}

function resetSummaryAuditFilters() {
    document.getElementById('search-audit-summary').value = '';
    document.getElementById('filter-audit-auditor').value = '';
    summarySortColumn = 'noSPP';
    summarySortDirection = 'asc';
    applySummaryAuditFilters();
}

function renderAuditSummaryRows(regulerProjects) {
    const tbodyAudit = document.getElementById('table-audit-body');
    if (!tbodyAudit) return;

    if (regulerProjects.length === 0) {
        tbodyAudit.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px;">Tidak ada data summary audit.</td></tr>`;
        return;
    }

    tbodyAudit.innerHTML = regulerProjects.map(item => {
        const isApproved = item.statusManager === "Approved by Manager";
        let approvalUI = `
            <button class="${isApproved ? 'btn-approval-ok' : 'btn-approval-not'}" onclick="toggleManagerApproval(${item.id})" title="Otorisasi Manager">
                ${isApproved ? 'Approved by Manager' : 'Not Approved'}
            </button>
        `;

        return `
        <tr>
            <td>
                <span class="code-tag code-tag-spp" onclick="openAuditDetailWindow('${item.noSPP}', '${item.jenis}')" title="Klik untuk membuka detail di tab baru">
                    🔗 ${item.noSPP}
                </span>
            </td>
            <td><span class="code-tag code-tag-lha">${item.noLHA}</span></td>
            <td><span class="code-tag code-tag-pica">${item.noPICA}</span></td>
            <td><b>${item.judul}</b></td>
            <td>${item.auditor}</td>
            <td><b>${item.tglSelesai ? formatIndonesianDate(new Date(item.tglSelesai)) : '-'}</b></td>
            <td>${approvalUI}</td>
        </tr>
        `;
    }).join('');
}

function toggleManagerApproval(id) {
    // Mengecek apakah user adalah Admin atau Manager
    if (!isHighPrivilegeUser()) {
        return alert("⛔ OTORISASI DITOLAK:\nHanya user dengan Role Admin / Manager yang dapat melakukan approval laporan!");
    }

    const doc = dbPenomoran.find(x => x.id === id);
    if (!doc) return;

    if (doc.statusManager === "Approved by Manager") {
        if (confirm(`Apakah Anda ingin MENGBATALKAN status approval untuk project ini?\n\nNomor LHA (${doc.noLHA}) dan PICA (${doc.noPICA}) akan dihapus dan menjadi available kembali.`)) {
            doc.statusManager = "Not Approved";
            doc.lhaSeq = null;
            doc.noLHA = "-";
            doc.picaSeq = null;
            doc.noPICA = "-";

            logActivity("Summary Audit", "Pembatalan Approval Manager & Reset LHA/PICA", doc.noSPP);
            syncPenomoranToFirebase();
            refreshUI();
            alert("⚠️ Approval dibatalkan. Nomor LHA & PICA telah dihapus dan siap digunakan untuk project lain!");
        }
        return;
    }

    const confirmed = confirm("Apakah Anda telah selesai mereview laporan ini dan hendak menyetujui penerbitan Nomor LHA & PICA?");
    if (confirmed) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const approvalMonthRoman = toRoman(today.getMonth() + 1);

        if (doc.jenis === "Investigasi") {
            doc.statusManager = "Approved by Manager";
            doc.noLHA = "N/A (Investigasi)";
            doc.noPICA = "N/A (Investigasi)";
        } else {
            const nextLHASeq = getNextLHASequence(currentYear);
            const nextPICASeq = getNextPICASequence(currentYear);

            doc.lhaSeq = nextLHASeq;
            doc.noLHA = `${String(nextLHASeq).padStart(3, '0')}/IA/JBA/LHA/${approvalMonthRoman}/${currentYear}`;
            doc.picaSeq = nextPICASeq;
            doc.noPICA = `${String(nextPICASeq).padStart(3, '0')}/IA/JBA/PICA/${approvalMonthRoman}/${currentYear}`;
            doc.statusManager = "Approved by Manager";
        }

        logActivity("Summary Audit", "Otorisasi Approval Manager & Terbit LHA/PICA", doc.noSPP);
        syncPenomoranToFirebase();
        refreshUI();
        alert(`🎉 Summary Audit Disetujui!\n\nNomor Resmi Terbit:\n• No. LHA: ${doc.noLHA}\n• No. PICA: ${doc.noPICA}`);
    }
}

// =========================================================================
// MODUL SUMMARY AUDIT & DETAIL FINDING MANAGEMENT
// =========================================================================

function openAuditDetailWindow(noSPP, jenis) {
    if (!noSPP) return alert("Dokumen project tidak ditemukan!");
    
    const safeSPP = encodeURIComponent(noSPP);
    // Buka halaman detail resmi dengan URL parameter resmi
    window.open(`detail.html?spp=${safeSPP}`, '_blank');
}

function sendPICA_Email(noSPP) {
    const doc = dbPenomoran.find(x => x.noSPP === noSPP);
    if (!doc) return alert("Data project tidak ditemukan!");

    let toEmail = "";
    let ccList = ["internal.audit@jba.co.id"];

    // Aturan Penerima Email (TO & CC)
    if (doc.emailSubRegional && doc.emailSubRegional.trim() !== "") {
        toEmail = doc.emailSubRegional;
        if (doc.emailRegionalHead) ccList.push(doc.emailRegionalHead);
    } else if (doc.emailKepalaPool && doc.emailKepalaPool.trim() !== "") {
        toEmail = doc.emailKepalaPool;
        if (doc.emailRegionalHead) ccList.push(doc.emailRegionalHead);
    } else {
        toEmail = doc.emailRegionalHead || "regional.head@jba.co.id";
    }

    const ccEmail = ccList.join(", ");

    const dateObj = doc.tglMulai ? new Date(doc.tglMulai) : new Date();
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const bulanMulai = months[dateObj.getMonth()];
    const tahunAudit = dateObj.getFullYear();

    const baseUrl = window.location.origin + window.location.pathname.replace("index.html", "");
    const auditeeLink = `${baseUrl}auditee.html?spp=${encodeURIComponent(doc.noSPP)}`;

    const subject = encodeURIComponent(`PICA ${doc.judul} - ${bulanMulai} ${tahunAudit}`);

    const namaPenerima = (doc.emailSubRegional && doc.emailSubRegional.trim() !== "") 
        ? (doc.subRegionalHead || "Bapak/Ibu") 
        : (doc.namaKepalaPool || "Bapak/Ibu");

    let bodyText = `Selamat Pagi Bapak ${namaPenerima}\n\n` +
        `Terima kasih atas supportnya dalam proses audit ${doc.judul}. Berikut saya lampirkan PICA untuk penyelesaian rekomendasi yang telah disetujui pada meeting Pre Closing Audit.\n\n` +
        `${auditeeLink}\n\n` +
        `Password untuk membuka summary audit :\n` +
        `1. Nomor Project / SPP\n` +
        `2. Nama Kepala Pool / Sub Regional Head\n\n` +
        `Mohon untuk melampirkan bukti foto dan melampirkan detail dari rekomendasi yang telah dilakukan oleh pihak auditee.\n\n` +
        `Mohon untuk feedback nya diselesaikan sebelum due date penyelesaian PICA.\n\n` +
        `Untuk pertanyaan lebih lanjut bisa menghubungi team Internal Audit melalui email atau nomor pribadi.\n\n` +
        `Best Regards,\n` +
        `Internal Audit Department`;

    let mailtoUrl = `mailto:${toEmail}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
    if (ccEmail.trim() !== "") {
        mailtoUrl += `&cc=${encodeURIComponent(ccEmail)}`;
    }

    logActivity("Summary Audit", "Pengiriman Email PICA Auditee (Outlook)", doc.noSPP);
    window.location.href = mailtoUrl;
}

function toggleFindingStatus(id, noSPP) {
    const idx = auditDatabase.findIndex(x => x.id === id);
    if (idx !== -1) {
        const currentStatus = (auditDatabase[idx].status || 'Open').toLowerCase();
        
        if (currentStatus === 'open') {
            const confirmed = confirm("Apakah perbaikan telah selesai?");
            if (!confirmed) return null;
            auditDatabase[idx].status = 'Closed';
        } else {
            auditDatabase[idx].status = 'Open';
        }

        syncAuditDbToFirebase();
        logActivity("Summary Audit", `Ubah Status Temuan (${auditDatabase[idx].status})`, noSPP);
        refreshUI();

        return auditDatabase[idx].status;
    }
    return null;
}

function deleteProjectSummary(noSPP) {
    const doc = dbPenomoran.find(x => x.noSPP === noSPP);
    const count = auditDatabase.filter(x => x.noSPP === noSPP).length;

    if (count === 0) {
        alert("Tidak ada data summary audit untuk dihapus.");
        return false;
    }

    if (confirm(`Apakah Anda yakin ingin MENGHAPUS PERMANEN seluruh summary audit (${count} temuan) untuk project:\n\n${doc ? doc.judul : noSPP}?`)) {
        auditDatabase = auditDatabase.filter(x => x.noSPP !== noSPP);

        syncAuditDbToFirebase();
        logActivity("Summary Audit", "Hapus Summary Audit Project", noSPP);
        refreshUI();

        return true;
    }
    return false;
}

function editFindingItem(id, noSPP, callback) {
    const finding = auditDatabase.find(x => x.id === id);
    if (!finding) return alert("Data temuan tidak ditemukan!");

    const newArea = prompt("Edit Area Pemeriksaan:", finding.area || "");
    if (newArea === null) return;

    const newFakta = prompt("Edit Kalimat Temuan / Fakta:", finding.fakta || "");
    if (newFakta === null) return;

    const newRoot = prompt("Edit Root Cause:", finding.rootCause || "");
    if (newRoot === null) return;

    const newRekomendasi = prompt("Edit Rekomendasi:", finding.rekomendasi || "");
    if (newRekomendasi === null) return;

    // Update objek di auditDatabase
    finding.area = newArea.trim();
    finding.fakta = newFakta.trim();
    finding.rootCause = newRoot.trim();
    finding.rekomendasi = newRekomendasi.trim();
    finding.updatedAt = new Date().toLocaleString('id-ID');

    // Sync ke Firebase & Dashboard
    syncAuditDbToFirebase();
    logActivity("Summary Audit", "Revisi Item Temuan Audit", noSPP);
    refreshUI();

    alert("✅ Data temuan berhasil diperbarui!");

    if (typeof callback === 'function') {
        callback(finding);
    }
}

// Listener Pesan dari Jendela Pop-up Detail
window.addEventListener('message', function(event) {
    const data = event.data;
    if (!data || !data.action) return;

    const sourceWin = event.source || currentDetailWindow;

    if (data.action === 'toggleStatus') {
        const newStatus = toggleFindingStatus(data.id, data.noSPP);
        if (newStatus && sourceWin) {
            sourceWin.postMessage({ type: 'STATUS_UPDATED', id: data.id, status: newStatus }, '*');
        }
    } else if (data.action === 'editFinding') {
        editFindingItem(data.id, data.noSPP, function(updatedFinding) {
            if (updatedFinding && sourceWin) {
                sourceWin.postMessage({ type: 'FINDING_EDITED', data: updatedFinding }, '*');
            }
        });
    } else if (data.action === 'deleteSummary') {
        const deleted = deleteProjectSummary(data.noSPP);
        if (deleted && sourceWin) {
            sourceWin.postMessage({ type: 'SUMMARY_DELETED' }, '*');
        }
    } else if (data.action === 'exportPICA') {
        exportPICA_Single(data.noSPP);
    } else if (data.action === 'exportLHA') {
        exportLHA_Single(data.noSPP);
    } else if (data.action === 'sendPICA') {
        sendPICA_Email(data.noSPP);
    }
});

function exportPICA_Single(noSPP) {
    const doc = dbPenomoran.find(x => x.noSPP === noSPP);
    const findings = auditDatabase.filter(x => x.noSPP === noSPP);

    if (!doc) return alert("Data project tidak ditemukan!");

    const exportData = findings.map((f, i) => ({
        "No": i + 1,
        "No. PICA": doc.noPICA,
        "Cabang / Unit": doc.judul,
        "Area Pemeriksaan": f.area,
        "Temuan / Fakta": f.fakta,
        "Root Cause": f.rootCause,
        "Rekomendasi": f.rekomendasi,
        "Status": f.status || "Open"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData.length ? exportData : [{ "Info": "Belum ada temuan" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PICA");
    XLSX.writeFile(wb, `PICA_${doc.noPICA.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

function exportLHA_Single(noSPP) {
    const doc = dbPenomoran.find(x => x.noSPP === noSPP);
    if (!doc) return alert("Data project tidak ditemukan!");

    alert(`📄 Menerbitkan PDF LHA resmi untuk No. LHA: ${doc.noLHA}...`);
}

function exportPPT_Single(noSPP) {
    const doc = dbPenomoran.find(x => x.noSPP === noSPP);
    const findings = auditDatabase.filter(x => x.noSPP === noSPP);

    if (!doc) return;

    let textContent = `SLIDE EXECUTIVE SUMMARY AUDIT\n`;
    textContent += `=====================================\n`;
    textContent += `Judul Project : ${doc.judul}\n`;
    textContent += `No. SPP       : ${doc.noSPP}\n`;
    textContent += `No. LHA       : ${doc.noLHA}\n`;
    textContent += `Lead Auditor  : ${doc.auditor}\n`;
    textContent += `Total Temuan  : ${findings.length} Temuan\n\n`;

    findings.forEach((f, i) => {
        textContent += `TEMUAN #${i+1}: ${f.area}\n`;
        textContent += `- Fakta      : ${f.fakta}\n`;
        textContent += `- Root Cause : ${f.rootCause}\n`;
        textContent += `- Rekomendasi: ${f.rekomendasi}\n\n`;
    });

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `PPT_Slide_${doc.judul.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    link.click();
}

function combineTwoProjectsPPT(spp1, spp2) {
    const doc1 = dbPenomoran.find(x => x.noSPP === spp1);
    const doc2 = dbPenomoran.find(x => x.noSPP === spp2);

    if (!doc1 || !doc2) return alert("Data project tidak valid!");

    const findings1 = auditDatabase.filter(x => x.noSPP === spp1);
    const findings2 = auditDatabase.filter(x => x.noSPP === spp2);

    let combined = `====================================================\n`;
    combined += `   COMBINED EXECUTIVE SUMMARY AUDIT SLIDES\n`;
    combined += `====================================================\n\n`;

    [ { doc: doc1, findings: findings1 }, { doc: doc2, findings: findings2 } ].forEach((item, idx) => {
        combined += `--- SLIDE PROJECT #${idx + 1}: ${item.doc.judul} ---\n`;
        combined += `• No. SPP       : ${item.doc.noSPP}\n`;
        combined += `• No. LHA       : ${item.doc.noLHA}\n`;
        combined += `• Lead Auditor  : ${item.doc.auditor}\n`;
        combined += `• Total Temuan  : ${item.findings.length}\n\n`;

        item.findings.forEach((f, i) => {
            combined += `  [Temuan ${i+1}] ${f.area}\n`;
            combined += `  - Fakta       : ${f.fakta}\n`;
            combined += `  - Root Cause  : ${f.rootCause}\n`;
            combined += `  - Rekomendasi : ${f.rekomendasi}\n\n`;
        });
        combined += `\n`;
    });

    const blob = new Blob([combined], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Combined_PPT_Slides_${new Date().toISOString().slice(0,10)}.txt`;
    link.click();
}

function uploadBatchPenomoranExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet);

            if (jsonRows.length === 0) {
                alert("⚠️ File Excel kosong!");
                e.target.value = "";
                return;
            }

            let insertedCount = 0;
            let duplicatesFound = [];
            let missingRequiredCount = 0;

            jsonRows.forEach((row, idx) => {
                const findValStrict = (exactKeywords, containsKeywords) => {
                    const keys = Object.keys(row);
                    let key = keys.find(k => exactKeywords.some(kw => k.toLowerCase().trim() === kw));
                    if (!key && containsKeywords) {
                        key = keys.find(k => containsKeywords.some(kw => k.toLowerCase().trim().includes(kw)));
                    }
                    return key ? String(row[key]).trim() : "";
                };

                const jenis = findValStrict(['tipe project', 'tipe', 'jenis'], ['tipe', 'jenis']) || "Reguler";
                const noSPP = findValStrict(['no. surat tugas / spp', 'no. spp', 'spp', 'no. surat'], ['spp', 'surat']);
                const judul = findValStrict(['judul project', 'pool / cabang / judul project', 'judul', 'cabang', 'pool'], ['judul', 'cabang', 'pool']);
                const auditor = findValStrict(['lead auditor', 'lead', 'auditor'], ['lead', 'auditor']);
                const auditMembers = findValStrict(['audit members', 'members', 'member'], ['member']) || "-";

                if (!noSPP || !judul || !auditor) {
                    missingRequiredCount++;
                    return;
                }

                const isDuplicate = dbPenomoran.some(x => x && x.noSPP && x.noSPP.toLowerCase() === noSPP.toLowerCase());
                if (isDuplicate) {
                    duplicatesFound.push(noSPP);
                    return;
                }

                let noLHA = findValStrict(['no. lha', 'lha'], ['lha']);
                let noPICA = findValStrict(['no. pica', 'pica'], ['pica']);

                const matchYear = noSPP.match(/\b(20\d{2})\b/);
                const targetYear = matchYear ? parseInt(matchYear[1], 10) : new Date().getFullYear();

                const matchSeq = noSPP.match(/^(\d+)/);
                const sppSeq = matchSeq ? parseInt(matchSeq[1], 10) : (idx + 1);

                let statusManager = "Not Approved";
                if (noLHA && noPICA && noLHA !== "-" && noPICA !== "-") {
                    statusManager = "Approved by Manager";
                } else {
                    noLHA = "-";
                    noPICA = "-";
                }

                const tglMulai = findValStrict(['mulai', 'tgl mulai'], ['mulai']) || new Date().toISOString().slice(0, 10);
                const tglSelesai = findValStrict(['selesai', 'tgl selesai'], ['selesai']) || new Date().toISOString().slice(0, 10);

                const newDoc = {
                    id: Date.now() + idx,
                    jenis: jenis,
                    year: targetYear,
                    sppSeq: sppSeq,
                    noSPP: noSPP,
                    lhaSeq: null,
                    noLHA: noLHA,
                    picaSeq: null,
                    noPICA: noPICA,
                    tanggalStart: formatIndonesianDate(new Date(tglMulai)),
                    tglMulai: tglMulai,
                    tglSelesai: tglSelesai,
                    tglPelaksanaan: `${formatIndonesianDate(new Date(tglMulai))} s.d ${formatIndonesianDate(new Date(tglSelesai))}`,
                    judul: judul,
                    regionalHead: regionalMap['reg1'].name,
                    jabatanRegionalHead: regionalMap['reg1'].title,
                    emailRegionalHead: regionalMap['reg1'].email,
                    subRegionalHead: subRegionalMap['sub1'].name,
                    emailSubRegional: subRegionalMap['sub1'].email,
                    emailKepalaPool: "kepala.pool@jba.co.id",
                    periodeAudit: findValStrict(['periode audit', 'periode'], ['periode']) || "N/A",
                    auditor: auditor,
                    auditMembers: auditMembers,
                    hasSignedSPP: true,
                    created_by: currentUserEmail || "Batch Upload",
                    statusManager: statusManager,
                    isBackdate: true
                };

                dbPenomoran.push(newDoc);
                insertedCount++;
            });

            syncPenomoranToFirebase();
            populateDropdowns();
            refreshUI();

            let msg = `✅ Berhasil meng-import ${insertedCount} dokumen dari Excel!\n`;
            if (duplicatesFound.length > 0) {
                msg += `\n⚠️ Terdapat ${duplicatesFound.length} nomor dokumen DUPLIKAT yang dilewati:\n- ` + duplicatesFound.join('\n- ');
            }
            if (missingRequiredCount > 0) {
                msg += `\n\n⚠️ ${missingRequiredCount} baris dilewati karena komponen wajib (Nomor Dokumen, Judul Project, atau Lead Auditor) tidak lengkap.`;
            }
            alert(msg);

        } catch (err) {
            alert("⚠️ Gagal memproses Excel: " + err.message);
        }
        e.target.value = "";
    };
    reader.readAsArrayBuffer(file);
}

function exportPenomoranExcel() {
    if (dbPenomoran.length === 0) return alert("Belum ada register nomor dokumen!");
    logActivity("Penomoran Dokumen", "Export Register Penomoran (Excel)", "All Data");

    const exportData = dbPenomoran.map((p, idx) => ({
        "No": idx + 1,
        "Tipe Project": p.jenis,
        "No. Surat Tugas / SPP": p.noSPP,
        "No. LHA": p.noLHA,
        "No. PICA": p.noPICA,
        "Pool / Cabang / Judul Project": p.judul,
        "Regional Head": `${p.regionalHead} (${p.jabatanRegionalHead})`,
        "Sub Regional Head": p.subRegionalHead || "-",
        "Periode Audit": p.periodeAudit,
        "Tanggal Pemeriksaan": p.tglPelaksanaan,
        "Tanggal Selesai Audit": p.tglSelesai ? formatIndonesianDate(new Date(p.tglSelesai)) : "-",
        "Lead Auditor": p.auditor,
        "Audit Members": p.auditMembers,
        "Email Kepala Pool": p.emailKepalaPool || "-",
        "Status Manager": p.statusManager
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Register_Penomoran");
    XLSX.writeFile(workbook, `Register_Penomoran_Dokumen_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function populateDropdowns() {
    const nonFraudList = dbPenomoran.filter(x => x.jenis !== "Investigasi");
    const regulerSelect = document.getElementById('audit-select-nomor');
    if (regulerSelect) {
        if (nonFraudList.length === 0) {
            regulerSelect.innerHTML = `<option value="">Belum ada project Reguler/Adhoc/Advisory</option>`;
        } else {
            regulerSelect.innerHTML = nonFraudList.map((item, idx) => 
                `<option value="${idx}">[${item.noSPP}] ${item.judul} (${item.jenis})</option>`
            ).join('');
        }
    }

    const fraudList = dbPenomoran.filter(x => x.jenis === "Investigasi");
    const fraudSelect = document.getElementById('fraud-select-nomor');
    if (fraudSelect) {
        if (fraudList.length === 0) {
            fraudSelect.innerHTML = `<option value="">Belum ada project Investigasi</option>`;
        } else {
            fraudSelect.innerHTML = fraudList.map((item, idx) => 
                `<option value="${idx}">[${item.noSPP}] ${item.judul}</option>`
            ).join('');
        }
    }
}

function updateExecutiveDashboard() {
    document.getElementById('kpi-exec-total').innerText = dbPenomoran.length;
    document.getElementById('kpi-exec-lha').innerText = auditDatabase.length + fraudDatabase.length;
    document.getElementById('kpi-exec-open').innerText = auditDatabase.filter(x => (x.status || 'Open').toLowerCase() === 'open').length + fraudDatabase.filter(x => (x.status || 'Open').toLowerCase() === 'open').length;
    document.getElementById('kpi-exec-rate').innerText = (auditDatabase.length + fraudDatabase.length) > 0 ? "85%" : "0%";
}

function renderPenomoranRows(dataList) {
    const tbodyPenomoran = document.getElementById('table-penomoran-body');
    if (!tbodyPenomoran) return;

    if (dataList.length === 0) {
        tbodyPenomoran.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 16px;">Tidak ada nomor dokumen yang sesuai.</td></tr>`;
        return;
    }

    tbodyPenomoran.innerHTML = dataList.map(item => `
        <tr>
            <td><span class="badge ${item.jenis === 'Investigasi' ? 'bg-high' : 'bg-progress'}">${item.jenis}</span></td>
            <td><span class="code-tag ${item.jenis === 'Investigasi' ? 'code-tag-investigasi' : 'code-tag-spp'}" onclick="openAuditDetailWindow('${item.noSPP}', '${item.jenis}')">${item.noSPP}</span></td>
            <td>
                ${item.jenis === 'Investigasi' ? '<span style="color:#94a3b8;">N/A</span>' : 
                    `<span class="code-tag code-tag-lha">${item.noLHA}</span> <span class="code-tag code-tag-pica">${item.noPICA}</span>`
                }
            </td>
            <td><b>${item.judul}</b></td>
            <td><b>${item.auditor || '-'}</b></td>
            <td><b style="color: var(--danger);">${item.tglSelesai ? formatIndonesianDate(new Date(item.tglSelesai)) : '-'}</b></td>
            <td>
                <div style="display: flex; gap: 4px; flex-wrap: nowrap; justify-content: center;">
                    <button class="btn-tbl-icon btn-tbl-edit" onclick="editDocumentNumber(${item.id})" title="Edit Data & Nomor Dokumen">✏️</button>
                    <button class="btn-tbl-icon btn-tbl-print" onclick="downloadSuratTugas(${item.id})" title="Print SPP / Surat Tugas PDF">🖨️</button>
                    <button class="btn-tbl-icon btn-tbl-send" onclick="sendSignedSPP_Email(${item.id})" title="Kirim Surat Tugas via Email">📧</button>
                    <button class="btn-tbl-icon btn-tbl-delete" onclick="deleteDocumentNumber(${item.id})" title="Hapus Nomor SPP Permanen">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderLogRows(logs) {
    const tbodyLog = document.getElementById('table-log-body');
    if (!tbodyLog) return;

    if (logs.length === 0) {
        tbodyLog.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">Belum ada riwayat aktivitas.</td></tr>`;
        return;
    }
    tbodyLog.innerHTML = logs.map(l => `
        <tr>
            <td style="white-space: nowrap;"><b>${l.timestamp}</b></td>
            <td><span class="badge bg-progress">${l.userEmail || '-'}</span></td>
            <td><span class="badge bg-high">${l.kategori}</span></td>
            <td><b>${l.aktivitas}</b></td>
            <td><span class="code-tag">${l.detailDoc}</span></td>
            <td><span class="badge bg-approved">${l.status}</span></td>
        </tr>
    `).join('');
}

function refreshUI() {
    updateExecutiveDashboard();
    updateExcelFilterDropdowns();
    applyExcelFilters();
    applySummaryAuditFilters();
    renderLogRows(activityLogs);

    const tbodyFraud = document.getElementById('table-fraud-body');
    if (tbodyFraud) {
        const fraudProjects = dbPenomoran.filter(x => x.jenis === 'Investigasi');
        if (fraudProjects.length === 0) {
            tbodyFraud.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">Belum ada project Investigasi yang diterbitkan.</td></tr>`;
        } else {
            tbodyFraud.innerHTML = fraudProjects.map(item => `
                <tr>
                    <td>
                        <span class="code-tag code-tag-investigasi" onclick="openAuditDetailWindow('${item.noSPP}', 'Investigasi')" title="Klik untuk membuka detail di tab baru">
                            🔗 ${item.noSPP}
                        </span>
                    </td>
                    <td><b>${item.judul}</b></td>
                    <td>${item.auditor}</td>
                    <td>${item.tglSelesai ? formatIndonesianDate(new Date(item.tglSelesai)) : '-'}</td>
                    <td><span class="badge bg-approved">${item.statusManager}</span></td>
                </tr>
            `).join('');
        }
    }
}

// FIREBASE INITIALIZATION & LISTENERS
const firebaseConfig = {
    apiKey: "AIzaSyA0aVH-JzpEztsnv8kwSpKPaa5qg2xzabI",
    authDomain: "dashboard-audit-e34bd.firebaseapp.com",
    projectId: "dashboard-audit-e34bd",
    storageBucket: "dashboard-audit-e34bd.firebasestorage.app",
    messagingSenderId: "32648456405",
    appId: "1:32648456405:web:b5f29449c7f9e2ec8fda5c",
    measurementId: "G-D9JPHK8KPQ",
    databaseURL: "https://dashboard-audit-e34bd-default-rtdb.asia-southeast1.firebasedatabase.app"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

function handleUserLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            document.getElementById('auth-login-overlay').style.display = 'none';
            document.getElementById('form-login-firebase').reset();
        })
        .catch((error) => alert("Gagal Login: " + error.message));
}

        auth.onAuthStateChanged((user) => {
            if (user) {
                currentUserEmail = user.email.toLowerCase();
                
                // Convert email ke Key Firebase (mengubah titik '.' jadi '_')
                const firebaseUserKey = currentUserEmail.replace(/\./g, '_');
        
                // BACA ROLE REALTIME DARI FIREBASE
                database.ref('users/' + firebaseUserKey).once('value')
                    .then((snapshot) => {
                        const userData = snapshot.val();
                        
                        if (userData && userData.role) {
                            currentUserRole = userData.role.toLowerCase().trim(); // Membaca "admin", "manager", atau "auditor"
                        } else {
                            currentUserRole = "auditor"; // Fallback default jika role tidak ditemukan
                        }
        
                        // Update timestamp last_login tanpa menimpa role di Firebase
                        database.ref('users/' + firebaseUserKey).update({
                            email: currentUserEmail,
                            last_login: new Date().toISOString()
                        }).catch(err => console.warn("Gagal update last_login:", err));
        
                        // Label Tampilan Header
                        let roleLabel = "AUDITOR";
                        if (currentUserRole === "admin") {
                            roleLabel = "ADMINISTRATOR";
                        } else if (currentUserRole === "manager") {
                            roleLabel = "MANAGER";
                        }
        
                        // --- PERBAIKAN SAFE GUARD (HANYA UPDATE JIKA ELEMEN TERSEDIA DI DOM) ---
                        const elEmail = document.getElementById('display-user-email');
                        const elRole = document.getElementById('display-user-role');
                        const elHeaderBadge = document.getElementById('user-badge-header');
                        const elOverlay = document.getElementById('auth-login-overlay');
        
                        if (elEmail) elEmail.innerText = user.email;
                        if (elRole) elRole.innerText = roleLabel;
                        if (elHeaderBadge) elHeaderBadge.style.display = 'flex';
                        if (elOverlay) elOverlay.style.display = 'none';
                        
                        listenDatabaseRealtime();
                    })
                    .catch((error) => {
                        console.error("Error reading role:", error);
                        currentUserRole = "auditor";
        
                        const elEmail = document.getElementById('display-user-email');
                        const elRole = document.getElementById('display-user-role');
                        const elHeaderBadge = document.getElementById('user-badge-header');
                        const elOverlay = document.getElementById('auth-login-overlay');
        
                        if (elEmail) elEmail.innerText = user.email;
                        if (elRole) elRole.innerText = "AUDITOR";
                        if (elHeaderBadge) elHeaderBadge.style.display = 'flex';
                        if (elOverlay) elOverlay.style.display = 'none';
        
                        listenDatabaseRealtime();
                    });
        
            } else {
                currentUserEmail = "";
                currentUserRole = "auditor";
        
                const elHeaderBadge = document.getElementById('user-badge-header');
                const elOverlay = document.getElementById('auth-login-overlay');
        
                if (elHeaderBadge) elHeaderBadge.style.display = 'none';
                if (elOverlay) elOverlay.style.display = 'flex';
            }
        });

function handleUserLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari akun?")) {
        auth.signOut();
    }
}

function listenDatabaseRealtime() {
    database.ref('dbPenomoran').on('value', (snapshot) => {
        const val = snapshot.val();
        if (Array.isArray(val)) {
            dbPenomoran = val.filter(Boolean);
        } else if (val && typeof val === 'object') {
            dbPenomoran = Object.values(val);
        } else {
            dbPenomoran = [];
        }
        populateDropdowns();
        updateSPPPreview();
        refreshUI();
    });

    database.ref('auditDatabase').on('value', (snapshot) => {
        auditDatabase = snapshot.val() || [];
        refreshUI();
    });

    database.ref('fraudDatabase').on('value', (snapshot) => {
        fraudDatabase = snapshot.val() || [];
        refreshUI();
    });

    database.ref('activityLogs').on('value', (snapshot) => {
        activityLogs = snapshot.val() || [];
        refreshUI();
    });
}

function downloadSuratTugas(id) {
    const doc = dbPenomoran.find(x => x.id === id);
    if (!doc) return alert("Data dokumen tidak ditemukan!");

    if (typeof window.jspdf === 'undefined') {
        return alert("Library jsPDF belum siap. Silakan muat ulang halaman!");
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    const marginLeft = 37.5;
    let y = 37.5;
    const centerX = 105;
    const maxTextWidth = 147.1;
    const lineSpacing15 = 7.5;

    // JUDUL & NOMOR SURAT
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Surat Pemberitahuan Penugasan", centerX, y, { align: "center" });

    pdf.setLineWidth(0.5);
    pdf.line(68, y + 1.2, 142, y + 1.2);

    y += lineSpacing15;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`No: ${doc.noSPP || '-'}`, centerX, y, { align: "center" });

    // KEPADA YTH & TUJUAN
    y += lineSpacing15 * 1.5;
    pdf.setFont("helvetica", "normal");
    pdf.text("Kepada Yth.", marginLeft, y);
    
    y += lineSpacing15;
    let jabRH = doc.jabatanRegionalHead || "Regional Head";
    if (jabRH.includes("Regional Head")) {
        let parts = jabRH.split("Regional Head");
        pdf.setFont("helvetica", "bolditalic");
        pdf.text("Regional Head", marginLeft, y);
        let rhWidth = pdf.getTextWidth("Regional Head");
        pdf.setFont("helvetica", "bold");
        pdf.text(parts[1] || "", marginLeft + rhWidth, y);
    } else {
        pdf.setFont("helvetica", "bold");
        pdf.text(jabRH, marginLeft, y);
    }
    
    y += lineSpacing15;
    pdf.setFont("helvetica", "bold");
    pdf.text(doc.regionalHead || "-", marginLeft, y);
    
    y += lineSpacing15;
    pdf.setFont("helvetica", "normal");
    pdf.text("ditempat", marginLeft, y);

    // PERIHAL & SALAM PEMBUKA
    y += lineSpacing15 * 1.2;
    pdf.setFont("helvetica", "bold");
    pdf.text("Perihal", marginLeft, y);
    pdf.setLineWidth(0.3);
    pdf.line(marginLeft, y + 0.8, marginLeft + 12, y + 0.8);

    pdf.setFont("helvetica", "normal");
    pdf.text(`: Internal Audit ${doc.jenis || 'Rutin'}`, marginLeft + 18, y);

    y += lineSpacing15 * 1.2;
    pdf.text("Dengan hormat,", marginLeft, y);
    y += lineSpacing15;
    pdf.text("Sehubungan dengan pelaksanaan Internal Audit JBA, maka kami akan menugaskan:", marginLeft, y);

    // TABEL RINCIAN PENUGASAN
    y += lineSpacing15 * 1.1;
    const colLabelX = marginLeft + 2;
    const colColonX = marginLeft + 46;
    const colValX   = marginLeft + 50;

    pdf.text("Nama", colLabelX, y);
    pdf.text(":", colColonX, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(doc.auditor || "-", colValX, y);
    if (doc.auditMembers && doc.auditMembers !== "-") {
        y += lineSpacing15;
        pdf.setFont("helvetica", "normal");
        pdf.text(doc.auditMembers, colValX, y);
    }

    y += lineSpacing15;
    pdf.setFont("helvetica", "normal");
    pdf.text("Ruang Lingkup", colLabelX, y);
    pdf.text(":", colColonX, y);
    pdf.text("Kegiatan Operasional Pool", colValX, y);

    y += lineSpacing15;
    pdf.text("Pool", colLabelX, y);
    pdf.text(":", colColonX, y);
    pdf.setFont("helvetica", "bold");
    pdf.text(doc.judul || "-", colValX, y);

    y += lineSpacing15;
    pdf.setFont("helvetica", "normal");
    pdf.text("Obyektif", colLabelX, y);
    pdf.text(":", colColonX, y);
    pdf.text("Observasi Efektivitas serta Efisiensi Operasional Pool", colValX, y);

    y += lineSpacing15;
    pdf.text("Periode Audit", colLabelX, y);
    pdf.text(":", colColonX, y);
    pdf.text(doc.periodeAudit || "-", colValX, y);

    let formattedTglPemeriksaan = doc.tglPelaksanaan || "-";
    if (doc.tglMulai && doc.tglSelesai) {
        formattedTglPemeriksaan = `${formatIndonesianDate(new Date(doc.tglMulai))} - ${formatIndonesianDate(new Date(doc.tglSelesai))}`;
    } else {
        formattedTglPemeriksaan = formattedTglPemeriksaan.replace(/\ss\.d\s/g, " - ");
    }

    y += lineSpacing15;
    pdf.text("Tanggal Pemeriksaan", colLabelX, y);
    pdf.text(":", colColonX, y);
    pdf.text(formattedTglPemeriksaan, colValX, y);

    // PENUTUP
    y += lineSpacing15 * 1.3;
    const p1 = "Berkenaan dengan penugasan tersebut, maka kami mengharapkan dukungan Bapak/Ibu & tim berupa penyediaan informasi dan data dari pihak yang terkait dengan kegiatan tersebut.";
    const linesP1 = pdf.splitTextToSize(p1, maxTextWidth);
    pdf.text(linesP1, marginLeft, y, { lineHeightFactor: 1.5 });

    y += (linesP1.length * lineSpacing15) + 2;
    pdf.text("Atas perhatian dan bantuannya, kami ucapkan terima kasih.", marginLeft, y);

    // TANDA TANGAN CEO
    y += lineSpacing15 * 1.5;
    const tglTerbit = doc.tanggalStart || formatIndonesianDate(new Date());
    pdf.text(`Jakarta, ${tglTerbit}`, marginLeft, y);

    y += 22;
    pdf.setFont("helvetica", "bold");
    pdf.text("Shioyama Kazuhiro", marginLeft, y);
    pdf.setLineWidth(0.3);
    pdf.line(marginLeft, y + 0.8, marginLeft + 35, y + 0.8);

    y += lineSpacing15 * 0.7;
    pdf.setFont("helvetica", "bolditalic");
    pdf.text("Chief Executive Officer", marginLeft, y);

    // SECTION CC DENGAN FORMAT: Nama (Jabatan Italic)
    y += lineSpacing15 * 1.5;
    pdf.setFont("helvetica", "normal");
    pdf.text("CC :", marginLeft, y);

    const poolLabel = (doc.namaKepalaPool && doc.namaKepalaPool.trim() !== "") 
        ? `${doc.namaKepalaPool} (Kepala Pool)` 
        : "Kepala Pool";

    if (doc.subRegionalHead && doc.subRegionalHead.trim() !== "") {
        y += lineSpacing15 * 0.8;
        pdf.setFont("helvetica", "normal");
        pdf.text(`1. ${doc.subRegionalHead} (`, marginLeft, y);
        let prefixWidth = pdf.getTextWidth(`1. ${doc.subRegionalHead} (`);
        
        pdf.setFont("helvetica", "italic");
        pdf.text("Sub Regional Head", marginLeft + prefixWidth, y);
        let srhWidth = pdf.getTextWidth("Sub Regional Head");
        
        pdf.setFont("helvetica", "normal");
        pdf.text(")", marginLeft + prefixWidth + srhWidth, y);
        
        y += lineSpacing15 * 0.8;
        pdf.text(`2. ${poolLabel}`, marginLeft, y);
    } else {
        y += lineSpacing15 * 0.8;
        pdf.setFont("helvetica", "normal");
        pdf.text(`1. ${poolLabel}`, marginLeft, y);
    }

    logActivity("Penomoran Dokumen", "Cetak Surat Tugas (Print Window)", doc.noSPP);

    pdf.autoPrint();
    window.open(pdf.output('bloburl'), '_blank');
}

function handleFileUpload(event, jenisCategory) {
    const file = event.target.files[0];
    if (!file) return;

    const selectEl = document.getElementById(jenisCategory === 'Investigasi' ? 'fraud-select-nomor' : 'audit-select-nomor');
    const selectedIdx = selectEl.value;

    if (selectedIdx === "" || selectedIdx === null) {
        alert("⚠️ Silakan pilih Target Project Audit terlebih dahulu sebelum meng-upload!");
        event.target.value = "";
        return;
    }

    const targetList = dbPenomoran.filter(x => jenisCategory === 'Investigasi' ? x.jenis === 'Investigasi' : x.jenis !== 'Investigasi');
    const selectedProject = targetList[selectedIdx];

    if (!selectedProject) {
        alert("⚠️ Target Project tidak valid!");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet);

            if (jsonRows.length === 0) {
                alert("⚠️ File upload kosong!");
                event.target.value = "";
                return;
            }

            // Hapus temuan lama untuk project yang dipilih agar tidak duplikat saat re-upload
            if (jenisCategory === 'Investigasi') {
                fraudDatabase = fraudDatabase.filter(x => x.noSPP !== selectedProject.noSPP);
            } else {
                auditDatabase = auditDatabase.filter(x => x.noSPP !== selectedProject.noSPP);
            }

            const newFindings = jsonRows.map((row, idx) => {
                const findVal = (keywords) => {
                    const keys = Object.keys(row);
                    const matchedKey = keys.find(k => keywords.some(kw => k.toLowerCase().trim().includes(kw)));
                    return matchedKey ? String(row[matchedKey]).trim() : "";
                };

                return {
                    id: Date.now() + idx,
                    noSPP: selectedProject.noSPP,
                    judul: selectedProject.judul,
                    area: findVal(['area', 'proses', 'kategori']) || "Operasional",
                    fakta: findVal(['fakta', 'temuan', 'kalimat', 'description']) || "-",
                    rootCause: findVal(['root', 'cause', 'akar', 'penyebab']) || "-",
                    rekomendasi: findVal(['rekomendasi', 'saran', 'action']) || "-",
                    status: "Open",
                    keteranganCabang: "",
                    uploadedBy: currentUserEmail,
                    files: []
                };
            });

            if (jenisCategory === 'Investigasi') {
                fraudDatabase.push(...newFindings);
                syncFraudDbToFirebase();
            } else {
                auditDatabase.push(...newFindings);
                syncAuditDbToFirebase();
            }

            logActivity("Summary Audit", `Upload Summary Audit (${newFindings.length} temuan)`, selectedProject.noSPP);
            refreshUI();

            const infoFileName = document.getElementById(jenisCategory === 'Investigasi' ? 'info-file-name-fraud' : 'info-file-name-reguler');
            const infoFileRows = document.getElementById(jenisCategory === 'Investigasi' ? 'info-file-rows-fraud' : 'info-file-rows-reguler');
            const infoBadge = document.getElementById(jenisCategory === 'Investigasi' ? 'file-info-badge-fraud' : 'file-info-badge-reguler');

            if (infoFileName && infoFileRows && infoBadge) {
                infoFileName.innerText = file.name;
                infoFileRows.innerText = newFindings.length;
                infoBadge.style.display = 'block';
            }

            alert(`✅ Berhasil meng-upload ${newFindings.length} temuan untuk project: ${selectedProject.judul} (${selectedProject.noSPP})`);

        } catch (err) {
            alert("⚠️ Gagal memproses file summary audit: " + err.message);
        }
        event.target.value = "";
    };

    reader.readAsArrayBuffer(file);
}
