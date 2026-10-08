const regionalMap = {
    "reg1": { name: "Irfan Baharudin", title: "Regional Head 1", email: "irfan.baharudin@jba.co.id" },
    "reg2": { name: "Syafi Munawir Almaki", title: "Regional Head 2", email: "syafi.almaki@jba.co.id" },
    "reg3": { name: "Tan Hung Pau", title: "Regional Head 3 & 4", email: "tan.pau@jba.co.id" }
};

function autoFillAuditeeEmail() {
    const selectedKey = document.getElementById('p-regional').value;
    if (regionalMap[selectedKey]) {
        document.getElementById('p-email').value = regionalMap[selectedKey].email;
    }
}

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

function initTodayDate() {
    const today = new Date();
    const inputTgl = document.getElementById('p-tgl-terbit');
    if (inputTgl) inputTgl.valueAsDate = today;
}

let dbPenomoran = [];
let auditDatabase = [];
let fraudDatabase = [];
let activityLogs = [];
let currentUserEmail = "";
let currentUserRole = "auditor";

// State Sorting Penomoran
let currentSortColumn = 'tglTerbitSPP';
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
    if (typeof database !== 'undefined') {
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

// URUTAN DOKUMEN REALTIME BERDASARKAN TOTAL DATA TERDAFTAR DI TAHUN TERKAIT
function getNextSPPSequence(targetYear) {
    const listInYear = dbPenomoran.filter(d => d.year === targetYear);
    return listInYear.length + 1;
}

function getNextLHASequence(targetYear) {
    const listInYear = dbPenomoran.filter(d => d.year === targetYear && d.lhaSeq);
    if (listInYear.length === 0) return 1;
    return Math.max(...listInYear.map(d => d.lhaSeq)) + 1;
}

function getNextPICASequence(targetYear) {
    const listInYear = dbPenomoran.filter(d => d.year === targetYear && d.picaSeq);
    if (listInYear.length === 0) return 1;
    return Math.max(...listInYear.map(d => d.picaSeq)) + 1;
}

function updateSPPPreview() {
    const editId = document.getElementById('edit-doc-id').value;
    if (editId) return;

    const jenis = document.getElementById('p-jenis').value;
    const tglTerbitRaw = document.getElementById('p-tgl-terbit').value;
    const isBackdate = document.getElementById('p-is-backdate').checked;
    const manualSeqVal = document.getElementById('p-manual-spp-seq').value;

    if (!tglTerbitRaw) {
        document.getElementById('live-spp-preview').innerText = "Pilih Tanggal Surat Terbit!";
        return;
    }

    const dateObj = new Date(tglTerbitRaw);
    const targetYear = dateObj.getFullYear();
    const monthRoman = toRoman(dateObj.getMonth() + 1);

    let targetSeq = (isBackdate && manualSeqVal) ? parseInt(manualSeqVal, 10) : getNextSPPSequence(targetYear);
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
    const regKey = document.getElementById('p-regional').value;
    const regionalHead = regionalMap[regKey].name;
    const jabatanRegionalHead = regionalMap[regKey].title;
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
    const tglTerbitRaw = document.getElementById('p-tgl-terbit').value;

    if (!tglTerbitRaw) return alert("Error: Tanggal Surat Terbit wajib diisi!");
    const dateObj = new Date(tglTerbitRaw);
    const targetYear = dateObj.getFullYear();
    const monthRoman = toRoman(dateObj.getMonth() + 1);
    const tglTerbitFormatted = formatIndonesianDate(dateObj);

    const email = document.getElementById('p-email').value;
    const ccEmail = document.getElementById('p-cc-email').value;

    if (editId) {
        const docIdx = dbPenomoran.findIndex(x => x.id == editId);
        if (docIdx !== -1) {
            const currentDoc = dbPenomoran[docIdx];
            
            let newSPP = document.getElementById('edit-manual-spp-val').value.trim() || currentDoc.noSPP;
            let newLHA = currentDoc.noLHA;
            let newPICA = currentDoc.noPICA;

            const duplicateSPPObj = dbPenomoran.find(x => x.id != editId && x.noSPP.toLowerCase() === newSPP.toLowerCase());
            if (duplicateSPPObj) {
                return alert(`⚠️ ERROR EDIT MANUAL:\nNomor SPP '${newSPP}' telah terregistrasi pada Project '${duplicateSPPObj.judul}'!`);
            }

            if (currentDoc.statusManager === "Approved by Manager") {
                newLHA = document.getElementById('edit-manual-lha').value.trim();
                newPICA = document.getElementById('edit-manual-pica').value.trim();

                if (!newLHA || !newPICA) {
                    return alert("⚠️ ERROR: No. LHA dan No. PICA tidak boleh kosong!");
                }
            }

            dbPenomoran[docIdx] = {
                ...currentDoc,
                jenis: jenis,
                noSPP: newSPP,
                noLHA: newLHA,
                noPICA: newPICA,
                judul: judul,
                regionalHead: regionalHead,
                jabatanRegionalHead: jabatanRegionalHead,
                periodeAudit: periode,
                tglMulai: tglMulai,
                tglSelesai: tglSelesai,
                tglPelaksanaan: tglPemeriksaanFormatted,
                auditor: auditor,
                auditMembers: auditMembers,
                emailAuditee: email,
                ccEmail: ccEmail,
                updated_by: currentUserEmail
            };

            logActivity("Penomoran Dokumen", "Revisi / Edit Project", newSPP);
            alert("Data Penomoran Project Berhasil Diperbarui!");
        }
    } else {
        let seqNum = (isBackdate && manualSeqVal) ? parseInt(manualSeqVal, 10) : getNextSPPSequence(targetYear);
        const seqStr = String(seqNum).padStart(3, '0');

        let autoSPP = "";
        if (jenis === "Investigasi") autoSPP = `${seqStr}/FOC-SRT TUGAS/${monthRoman}/${targetYear}`;
        else if (jenis === "Adhoc") autoSPP = `${seqStr}/SPP-ADH/JBA-IA/${monthRoman}/${targetYear}`;
        else if (jenis === "Advisory") autoSPP = `${seqStr}/SPP-ADV/JBA-IA/${monthRoman}/${targetYear}`;
        else autoSPP = `${seqStr}/SPP/JBA-IA/${monthRoman}/${targetYear}`;

        const duplicateObj = dbPenomoran.find(item => item.noSPP && item.noSPP.toLowerCase() === autoSPP.toLowerCase());
        if (duplicateObj) {
            return alert(`⚠️ ERROR DUPLIKASI DOKUMEN:\nNomor SPP '${autoSPP}' telah terregistrasi pada Project '${duplicateObj.judul}'!`);
        }

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
            tglTerbitSPP: tglTerbitRaw,
            tglMulai: tglMulai,
            tglSelesai: tglSelesai,
            tglPelaksanaan: tglPemeriksaanFormatted,
            judul: judul,
            regionalHead: regionalHead,
            jabatanRegionalHead: jabatanRegionalHead,
            periodeAudit: periode,
            auditor: auditor,
            auditMembers: auditMembers,
            emailAuditee: email,
            ccEmail: ccEmail,
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

// EDIT FORM DENGAN TETAP MEMPERTAHANKAN INFORMASI PADA INPUT FORM
function editDocumentNumber(id) {
    const doc = dbPenomoran.find(x => x.id === id);
    if (!doc) return;

    document.getElementById('edit-doc-id').value = doc.id;
    document.getElementById('p-jenis').value = doc.jenis || "Reguler";
    document.getElementById('p-judul').value = doc.judul || "";
    document.getElementById('p-periode').value = doc.periodeAudit || "";
    document.getElementById('p-auditor').value = doc.auditor || "";
    
    if (doc.tglMulai) document.getElementById('p-tgl-mulai').value = doc.tglMulai;
    if (doc.tglSelesai) document.getElementById('p-tgl-selesai').value = doc.tglSelesai;
    if (doc.tglTerbitSPP) document.getElementById('p-tgl-terbit').value = doc.tglTerbitSPP;

    const members = (doc.auditMembers || '').split(', ');
    document.getElementById('p-member1').value = members[0] || '';
    document.getElementById('p-member2').value = members[1] || '';
    
    document.getElementById('p-email').value = doc.emailAuditee || '';
    document.getElementById('p-cc-email').value = doc.ccEmail || '';

    document.getElementById('container-edit-manual-spp').style.display = "block";
    document.getElementById('edit-manual-spp-val').value = doc.noSPP;
    document.getElementById('container-live-spp-preview').style.display = "none";

    if (doc.statusManager === "Approved by Manager") {
        document.getElementById('container-edit-manual-approved').style.display = "block";
        document.getElementById('edit-manual-lha').value = doc.noLHA;
        document.getElementById('edit-manual-pica').value = doc.noPICA;
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

        if (typeof database !== 'undefined' && database && database.ref) {
            database.ref('dbPenomoran/' + id).remove();
        }

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
    toggleBackDateFields();
    autoFillAuditeeEmail();
    initTodayDate();

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

    let toEmail = doc.emailAuditee || "auditee@jba.co.id";
    let ccEmail = doc.ccEmail || "";

    let subject = encodeURIComponent(`[SURAT PENUGASAN INTERNAL AUDIT] ${doc.judul} - ${doc.noSPP}`);
    let body = encodeURIComponent(
        `Yth. Tim Auditee / Management ${doc.judul},\n\n` +
        `Bersama email ini kami sampaikan Surat Perintah Penugasan Internal Audit resmi yang telah ditandatangani:\n\n` +
        ` Nomor Surat        : ${doc.noSPP}\n` +
        ` Cabang / Hub       : ${doc.judul}\n` +
        ` Periode Audit      : ${doc.periodeAudit}\n` +
        ` Tanggal Pemeriksaan: ${doc.tglPelaksanaan}\n` +
        ` Lead Auditor       : ${doc.auditor}\n\n` +
        `Mohon dapat memproses dan memfasilitasi kebutuhan data audit terkait.\n\n` +
        `Terima Kasih,\nInternal Audit Department`
    );

    let mailtoUrl = `mailto:${toEmail}?subject=${subject}&body=${body}`;
    if (ccEmail.trim() !== "") {
        mailtoUrl += `&cc=${encodeURIComponent(ccEmail)}`;
    }

    logActivity("Penomoran Dokumen", "Pengiriman Email Surat Tugas (Outlook)", doc.noSPP);
    window.location.href = mailtoUrl;
}

// -------------------------------------------------------------
// FILTER & SORTING ALA EXCEL UNTUK TAB PENOMORAN DOKUMEN
// -------------------------------------------------------------
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
        } else if (currentSortColumn === 'tglTerbitSPP' || currentSortColumn === 'id') {
            valA = new Date(a.tglTerbitSPP || a.id).getTime() || 0;
            valB = new Date(b.tglTerbitSPP || b.id).getTime() || 0;
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
    currentSortColumn = 'tglTerbitSPP';
    currentSortDirection = 'desc';
    
    document.querySelectorAll('.sort-icon').forEach(el => el.innerText = '⇅');
    const activeIcon = document.getElementById('sort-icon-tglTerbitSPP');
    if (activeIcon) activeIcon.innerText = '▼';

    applyExcelFilters();
}

// -------------------------------------------------------------
// FILTER & SORTING ALA EXCEL UNTUK TAB SUMMARY AUDIT
// -------------------------------------------------------------
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
        tbodyAudit.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">Tidak ada data summary audit.</td></tr>`;
        return;
    }

    tbodyAudit.innerHTML = regulerProjects.map(item => {
        const isApproved = item.statusManager === "Approved by Manager";
        let approvalUI = `
            <button class="${isApproved ? 'btn-approval-ok' : 'btn-approval-not'}" onclick="toggleManagerApproval(${item.id})" title="Klik otorisasi approval & terbitkan LHA/PICA">
                ${isApproved ? 'Approved by Manager' : 'Not Approved'}
            </button>
        `;

        return `
        <tr>
            <td style="text-align: center;">
                <input type="checkbox" class="chk-select-project" value="${item.noSPP}">
            </td>
            <td>
                <span class="code-tag code-tag-spp" onclick="openAuditDetailWindow('${item.noSPP}', '${item.jenis}')" title="Klik untuk membuka detail & cetak LHA/PICA/PPT">
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

// -------------------------------------------------------------
// DETAIL POP-UP WINDOW & TOMBOL DOWNLOAD PICA, LHA, PPT
// -------------------------------------------------------------
function openAuditDetailWindow(noSPP, jenis) {
    const doc = dbPenomoran.find(x => x.noSPP === noSPP);
    if (!doc) return alert("Dokumen project tidak ditemukan!");

    const projectFindings = auditDatabase.filter(x => x.noSPP === noSPP);

    let rowsHTML = "";
    if (projectFindings.length === 0) {
        rowsHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 20px;">Belum ada data temuan ringkasan audit yang di-upload untuk project ini.</td></tr>`;
    } else {
        rowsHTML = projectFindings.map((f, idx) => {
            const isClosed = (f.status || 'Open').toLowerCase() === 'closed';
            const btnColor = isClosed ? '#10b981' : '#ef4444';
            const statusText = isClosed ? 'Closed' : 'Open';

            return `
            <tr>
                <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                <td><b>${f.area || '-'}</b></td>
                <td>${f.fakta || '-'}</td>
                <td>${f.rootCause || '-'}</td>
                <td>${f.rekomendasi || '-'}</td>
                <td style="text-align: center;">
                    <button onclick="window.opener.toggleFindingStatus(${f.id}, '${noSPP}'); location.reload();" 
                            style="background: ${btnColor}; color: white; border: none; padding: 6px 14px; border-radius: 12px; font-weight: bold; cursor: pointer; font-size: 11px;">
                        ${statusText}
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }

    const detailHTML = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <title>Summary Finding - ${doc.noSPP}</title>
        <link rel="stylesheet" href="style.css">
        <style>
            body { padding: 30px; background: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            .detail-card { background: white; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: #f1f5f9; padding: 16px; border-radius: 6px; margin: 16px 0; }
            .btn-export-group { display: flex; gap: 10px; margin-top: 15px; }
            .btn-exp { padding: 8px 14px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; color: white; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="detail-card">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
                <div>
                    <h2 style="color: #0f172a; margin-bottom: 4px;">Detail Summary Audit & Temuan</h2>
                    <span style="font-size: 12px; color: #64748b;">Project: <b>${doc.judul}</b></span>
                </div>
                <span class="badge ${doc.jenis === 'Investigasi' ? 'bg-high' : 'bg-progress'}" style="font-size: 13px; padding: 6px 12px;">${doc.jenis}</span>
            </div>

            <!-- ACTION EXPORT BUTTONS (PICA, LHA, PPT) -->
            <div class="btn-export-group">
                <button class="btn-exp" style="background: #16a34a;" onclick="window.opener.exportPICA_Single('${doc.noSPP}')">📊 Download PICA (Excel)</button>
                <button class="btn-exp" style="background: #dc2626;" onclick="window.opener.exportLHA_Single('${doc.noSPP}')">📄 Download LHA (PDF)</button>
                <button class="btn-exp" style="background: #d97706;" onclick="window.opener.exportPPT_Single('${doc.noSPP}')">💻 Download PPT / Ringkasan Slide</button>
            </div>

            <div class="meta-grid">
                <div><small style="color: #64748b; font-weight: bold;">NO. SURAT TUGAS / SPP</small><br><b style="color: #0284c7;">${doc.noSPP}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">NO. LHA</small><br><b style="color: #dc2626;">${doc.noLHA}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">NO. PICA</small><br><b style="color: #16a34a;">${doc.noPICA}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">LEAD AUDITOR</small><br><b>${doc.auditor}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">REGIONAL HEAD</small><br><b>${doc.regionalHead}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">TANGGAL SELESAI AUDIT</small><br><b style="color: #ef4444;">${doc.tglSelesai ? window.opener.formatIndonesianDate(new Date(doc.tglSelesai)) : '-'}</b></div>
            </div>

            <h3 style="margin-top: 24px; margin-bottom: 12px; font-size: 16px; color: #0f172a;">📋 Ringkasan Daftar Temuan (Summary Findings)</h3>
            
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">No</th>
                            <th style="width: 160px;">Area Pemeriksaan</th>
                            <th>Kalimat Fakta</th>
                            <th>Root Cause</th>
                            <th>Rekomendasi</th>
                            <th style="width: 100px; text-align: center;">Status Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHTML}
                    </tbody>
                </table>
            </div>
        </div>
    </body>
    </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(detailHTML);
    win.document.close();
}

// -------------------------------------------------------------
// EXPORT SINGLE DOKUMEN (PICA, LHA, PPT)
// -------------------------------------------------------------
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
    XLSX.writeFile(wb, `PICA_${doc.judul.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
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
    link.download = `Slide_Audit_${doc.judul.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    link.click();
}

// COMBINE MULTIPLE PROJECT PPT (+)
function combineSelectedProjectsPPT() {
    const checkboxes = document.querySelectorAll('.chk-select-project:checked');
    if (checkboxes.length === 0) {
        return alert("⚠️ Mohon pilih centang minimal 1 project audit pada tabel terlebih dahulu!");
    }

    let combinedContent = `====================================================\n`;
    combinedContent += `   COMBINED EXECUTIVE SUMMARY PRESENTATION SLIDES\n`;
    combinedContent += `====================================================\n\n`;

    checkboxes.forEach((cb, idx) => {
        const noSPP = cb.value;
        const doc = dbPenomoran.find(x => x.noSPP === noSPP);
        const findings = auditDatabase.filter(x => x.noSPP === noSPP);

        if (doc) {
            combinedContent += `--- SLIDE PROJECT #${idx + 1}: ${doc.judul} ---\n`;
            combinedContent += `• No. SPP       : ${doc.noSPP}\n`;
            combinedContent += `• No. LHA       : ${doc.noLHA}\n`;
            combinedContent += `• Lead Auditor  : ${doc.auditor}\n`;
            combinedContent += `• Total Temuan  : ${findings.length}\n\n`;

            findings.forEach((f, i) => {
                combinedContent += `  [Temuan ${i+1}] ${f.area}\n`;
                combinedContent += `  - Fakta       : ${f.fakta}\n`;
                combinedContent += `  - Root Cause  : ${f.rootCause}\n`;
                combinedContent += `  - Rekomendasi : ${f.rekomendasi}\n\n`;
            });
            combinedContent += `\n`;
        }
    });

    const blob = new Blob([combinedContent], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Combined_Audit_PPT_Slides_${new Date().toISOString().slice(0,10)}.txt`;
    link.click();
}

// CETAK SURAT TUGAS FORMAT TANGGAL PEMERIKSAAN
function downloadSuratTugas(id) {
    const doc = dbPenomoran.find(x => x.id === id);
    if (!doc) return alert("Dokumen tidak ditemukan!");

    logActivity("Penomoran Dokumen", "Cetak / Print Surat Tugas", doc.noSPP);
    const daftarAuditor = doc.auditMembers !== "-" ? `${doc.auditor}, ${doc.auditMembers}` : `${doc.auditor}`;

    const printHTML = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <title>Surat Tugas - ${doc.noSPP}</title>
       <style>
        @page { size: A4 portrait; margin: 20mm 25mm 20mm 25mm; }
        body { font-family: 'Times New Roman', Times, serif; margin: 0; padding: 0; color: #000; line-height: 1.5; font-size: 14px; }
        .header { text-align: center; margin-bottom: 25px; }
        .header h2 { font-size: 16px; margin: 0; font-weight: bold; }
        .header p { margin: 2px 0 0 0; }
        table.meta-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        table.meta-table td { padding: 3px 0; vertical-align: top; }
        table.meta-table td.label { width: 160px; }
        table.meta-table td.colon { width: 20px; text-align: left; }
        .signature-section { margin-top: 50px; float: left; text-align: left; width: 220px; }
        @media print { body { margin: 0; padding: 0; } .no-print { display: none; } }
       </style>
    </head>
    <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🖨️ Cetak / Download PDF</button>
        </div>
        <div class="header">
            <h2 style="font-weight: bold; text-decoration: underline;">Surat Pemberitahuan Penugasan</h2>
            <p>No: ${doc.noSPP}</p>
        </div>

        <p>Kepada Yth.<br>${doc.jabatanRegionalHead}<br>${doc.regionalHead}<br>ditempat</p>
        <p style="margin-top: 15px;">Perihal Internal Audit (${doc.jenis})</p>
        <p style="margin-top: 10px;">Dengan hormat,</p>
        <p>Sehubungan dengan pelaksanaan Internal Audit JBA, maka kami akan menugaskan:</p>

        <table class="meta-table">
            <tr><td class="label">Nama</td><td class="colon">:</td><td>${daftarAuditor}</td></tr>
            <tr><td class="label">Ruang Lingkup</td><td class="colon">:</td><td>Kegiatan Operasional Cabang/Hub</td></tr>
            <tr><td class="label">Cabang / Hub</td><td class="colon">:</td><td>${doc.judul}</td></tr>
            <tr><td class="label">Obyektif</td><td class="colon">:</td><td>Observasi Efektivitas serta Efisiensi Operasional Cabang/Hub</td></tr>
            <tr><td class="label">Periode Audit</td><td class="colon">:</td><td>${doc.periodeAudit}</td></tr>
            <tr><td class="label">Tanggal Pemeriksaan</td><td class="colon">:</td><td>${doc.tglPelaksanaan}</td></tr>
        </table>

        <p>Berkenaan dengan penugasan tersebut, maka kami mengharapkan dukungan Bapak & tim<br>berupa penyediaan informasi dan data dari pihak yang terkait dengan kegiatan tersebut.</p>
        <p style="margin-top: 10px;">Atas perhatian dan bantuannya, kami ucapkan terima kasih.</p>

        <div class="signature-section">
            <p>Jakarta, ${doc.tanggalStart}</p>
            <br><br><br><br>
            <p style="font-weight: bold; text-decoration: underline;"> Shioyama Kazuhiro</p>
            <p style="font-style: italic"> Chief Executive Officer</p>
        </div>
    </body>
    </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(printHTML);
    win.document.close();
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
            jsonRows.forEach((row, idx) => {
                const findVal = (keywords) => {
                    const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().trim().includes(kw)));
                    return key ? String(row[key]).trim() : "";
                };

                const jenis = findVal(['tipe', 'jenis']) || "Reguler";
                const noSPP = findVal(['spp', 'no. spp', 'surat tugas', 'no. surat']);
                const judul = findVal(['judul', 'cabang', 'pool', 'project']);

                if (!noSPP || !judul) return;

                const exists = dbPenomoran.some(x => x.noSPP.toLowerCase() === noSPP.toLowerCase());
                if (exists) return;

                const tglTerbitRaw = findVal(['terbit', 'tanggal terbit', 'tgl terbit']);
                let dateObj = tglTerbitRaw ? new Date(tglTerbitRaw) : new Date();
                if (isNaN(dateObj.getTime())) dateObj = new Date();

                const tglMulai = findVal(['mulai', 'tgl mulai']) || "-";
                const tglSelesai = findVal(['selesai', 'tgl selesai']) || "-";

                const newDoc = {
                    id: Date.now() + idx,
                    jenis: jenis,
                    year: dateObj.getFullYear(),
                    noSPP: noSPP,
                    noLHA: findVal(['lha', 'no. lha']) || "-",
                    noPICA: findVal(['pica', 'no. pica']) || "-",
                    tanggalStart: formatIndonesianDate(dateObj),
                    tglTerbitSPP: dateObj.toISOString().slice(0, 10),
                    tglMulai: tglMulai,
                    tglSelesai: tglSelesai,
                    tglPelaksanaan: `${tglMulai} s.d ${tglSelesai}`,
                    judul: judul,
                    regionalHead: regionalMap['reg1'].name,
                    jabatanRegionalHead: regionalMap['reg1'].title,
                    periodeAudit: findVal(['periode']) || "N/A",
                    auditor: findVal(['lead', 'auditor']) || "Auditor",
                    auditMembers: findVal(['member']) || "-",
                    emailAuditee: findVal(['email']) || "auditee@jba.co.id",
                    ccEmail: "-",
                    hasSignedSPP: true,
                    created_by: currentUserEmail || "Batch Upload",
                    statusManager: "Not Approved",
                    isBackdate: true
                };

                dbPenomoran.push(newDoc);
                insertedCount++;
            });

            syncPenomoranToFirebase();
            populateDropdowns();
            refreshUI();
            alert(`✅ ${insertedCount} dokumen berhasil di-import dari Excel!`);
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
        "Periode Audit": p.periodeAudit,
        "Tanggal Pemeriksaan": p.tglPelaksanaan,
        "Tanggal Selesai Audit": p.tglSelesai ? formatIndonesianDate(new Date(p.tglSelesai)) : "-",
        "Lead Auditor": p.auditor,
        "Audit Members": p.auditMembers,
        "Tanggal Terbit": p.tanggalStart,
        "Email Auditee": p.emailAuditee,
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
        tbodyPenomoran.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 16px;">Tidak ada nomor dokumen yang sesuai.</td></tr>`;
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
            <td>${item.tanggalStart}</td>
            <td>
                <div style="display: flex; gap: 4px; flex-wrap: nowrap; justify-content: center;">
                    <button class="btn-tbl-icon btn-tbl-edit" onclick="editDocumentNumber(${item.id})" title="Edit Data & Nomor Dokumen">✏️</button>
                    <button class="btn-tbl-icon btn-tbl-print" onclick="downloadSuratTugas(${item.id})" title="Print SPP / Surat Tugas PDF">🖨️</button>
                    <button class="btn-tbl-icon btn-tbl-upload" onclick="openUploadSppModal(${item.id})" title="${item.hasSignedSPP ? 'Berkas Basah Sudah Ada' : 'Lampirkan File Basah'}">
                        ${item.hasSignedSPP ? '✅' : '📎'}
                    </button>
                    <button class="btn-tbl-icon btn-tbl-send" ${!item.hasSignedSPP ? 'disabled title="Upload Surat Tugas bertanda tangan basah terlebih dahulu"' : 'title="Kirim Surat Tugas via Email"'} onclick="sendSignedSPP_Email(${item.id})">📧</button>
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

initTodayDate();
autoFillAuditeeEmail();

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
        currentUserEmail = user.email;
        currentUserRole = "admin";

        document.getElementById('display-user-email').innerText = `${user.email} [ADMIN]`;
        document.getElementById('user-badge-header').style.display = 'flex';
        document.getElementById('auth-login-overlay').style.display = 'none';
        
        listenDatabaseRealtime();
    } else {
        currentUserEmail = "";
        currentUserRole = "auditor";
        document.getElementById('user-badge-header').style.display = 'none';
        document.getElementById('auth-login-overlay').style.display = 'flex';
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
