const regionalMap = {
    "reg1": { name: "Irfan Baharudin", title: "Regional Head 1", email: "irfan.baharudin@jba.co.id" },
    "reg2": { name: "Syafi Munawir Almaki", title: "Regional Head 2", email: "syafi.almaki@jba.co.id" },
    "reg3": { name: "Tan Hung Pau", title: "Regional Head 3 & 4", email: "tan.pau@jba.co.id" }
};

// Daftar email yang berhak melakukan Approval (Admin & Manager ke atas)
const listAdminManagerEmails = [
    'ahmad.shobri@jba.co.id',
    'manager@jba.co.id',
    'head@jba.co.id'
];

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

let dbPenomoran = [];
let auditDatabase = [];
let fraudDatabase = [];
let activityLogs = [];
let currentUserEmail = "";
let currentUserRole = "auditor"; // auditor | manager

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
    // Filter dokumen berdasarkan tahun DAN jenis surat tugas/audit yang sama
    const listInYearAndType = dbPenomoran.filter(d => d.year === targetYear && d.jenis === targetJenis && d.sppSeq);
    
    if (listInYearAndType.length === 0) return 1;
    
    // Cari nilai sppSeq paling tinggi dari jenis tersebut, lalu tambahkan 1
    return Math.max(...listInYearAndType.map(d => Number(d.sppSeq) || 0)) + 1;
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
    const tglMulai = document.getElementById('p-tgl-mulai').value;
    const isBackdate = document.getElementById('p-is-backdate').checked;
    const manualSeqVal = document.getElementById('p-manual-spp-seq').value;

    const dateObj = tglMulai ? new Date(tglMulai) : new Date();
    const targetYear = dateObj.getFullYear();
    const monthRoman = toRoman(dateObj.getMonth() + 1);

    // Kirim targetYear dan jenis ke fungsi getNextSPPSequence
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

    const dateObj = new Date(tglMulai);
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

            dbPenomoran[docIdx] = {
                ...currentDoc,
                jenis: jenis,
                noSPP: newSPP,
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
        let seqNum = (isBackdate && manualSeqVal) ? parseInt(manualSeqVal, 10) : getNextSPPSequence(targetYear, jenis);
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

function editDocumentNumber(id) {
    const doc = dbPenomoran.find(x => x.id === id);
    if (!doc) return;

    // Set ID dokumen yang sedang diedit
    document.getElementById('edit-doc-id').value = doc.id;
    
    // Mengisi kembali seluruh input form sesuai data terdaftar
    document.getElementById('p-jenis').value = doc.jenis || "Reguler";
    document.getElementById('p-judul').value = doc.judul || "";
    document.getElementById('p-periode').value = doc.periodeAudit || "";
    document.getElementById('p-auditor').value = doc.auditor || "";
    
    if (doc.tglMulai) document.getElementById('p-tgl-mulai').value = doc.tglMulai;
    if (doc.tglSelesai) document.getElementById('p-tgl-selesai').value = doc.tglSelesai;

    const members = (doc.auditMembers || '').split(', ');
    document.getElementById('p-member1').value = members[0] || '';
    document.getElementById('p-member2').value = members[1] || '';
    
    document.getElementById('p-email').value = doc.emailAuditee || '';
    document.getElementById('p-cc-email').value = doc.ccEmail || '';

    // Tampilkan field edit nomor manual dan isi dengan nomor yang terdaftar
    document.getElementById('container-edit-manual-spp').style.display = "block";
    document.getElementById('edit-manual-spp-val').value = doc.noSPP;
    
    // Sembunyikan elemen yang tidak diperlukan saat edit
    document.getElementById('container-live-spp-preview').style.display = "none";
    document.getElementById('container-backdate-toggle').style.display = "none";

    // Jika status sudah di-approve manager, tampilkan bidang edit LHA & PICA
    if (doc.statusManager === "Approved by Manager") {
        document.getElementById('container-edit-manual-approved').style.display = "block";
        document.getElementById('edit-manual-lha').value = doc.noLHA || "";
        document.getElementById('edit-manual-pica').value = doc.noPICA || "";
    } else {
        document.getElementById('container-edit-manual-approved').style.display = "none";
    }

    // Ubah tampilan UI Tombol & Judul
    document.getElementById('form-penomoran-title').innerText = "⚙️ Edit Project & Penomoran Dokumen";
    document.getElementById('btn-submit-penomoran').innerText = "💾 Simpan Perubahan";
    document.getElementById('btn-cancel-edit').style.display = "block";

    // Scroll ke atas dengan halus
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

// FILTER & SORTING ALA EXCEL DOKUMEN
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

// FILTER & SORTING SUMMARY AUDIT
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

// APPROVAL MANAGER / ADMIN
function toggleManagerApproval(id) {
    if (currentUserRole !== "manager") {
        return alert("⛔ OTORISASI DITOLAK:\nHanya user dengan Role Admin / Manager yang dapat melakukan approval laporan!");
    }

    const doc = dbPenomoran.find(x => x.id === id);
    if (!doc) return;

    if (doc.statusManager === "Approved by Manager") {
        if (confirm("Project ini sudah di-approve. Apakah Anda ingin MENGBATALKAN status approval?")) {
            doc.statusManager = "Not Approved";
            logActivity("Summary Audit", "Pembatalan Approval Manager", doc.noSPP);
            syncPenomoranToFirebase();
            refreshUI();
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

// OPEN AUDIT DETAIL TAB BARU
function openAuditDetailWindow(noSPP, jenis) {
    const doc = dbPenomoran.find(x => x.noSPP === noSPP);
    if (!doc) return alert("Dokumen project tidak ditemukan!");

    const projectFindings = auditDatabase.filter(x => x.noSPP === noSPP);
    const otherProjects = dbPenomoran.filter(x => x.noSPP !== noSPP && x.jenis !== 'Investigasi');

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
                    <button onclick="if(window.opener && window.opener.toggleFindingStatus){ window.opener.toggleFindingStatus(${f.id}, '${noSPP}'); location.reload(); }" 
                            style="background: ${btnColor}; color: white; border: none; padding: 6px 14px; border-radius: 12px; font-weight: bold; cursor: pointer; font-size: 11px;">
                        ${statusText}
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }

    const otherProjectOptions = otherProjects.map(p => `<option value="${p.noSPP}">[${p.noSPP}] ${p.judul}</option>`).join('');
    const tglSelesaiFormatted = doc.tglSelesai ? formatIndonesianDate(new Date(doc.tglSelesai)) : '-';

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
            .btn-export-group { display: flex; gap: 10px; margin-top: 15px; align-items: center; flex-wrap: wrap; }
            .btn-exp { padding: 8px 14px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; color: white; font-size: 12px; }
            .btn-exp:disabled { background: #cbd5e1 !important; color: #94a3b8 !important; cursor: not-allowed; }
            .ppt-combine-wrapper { display: inline-flex; align-items: center; gap: 6px; background: #fef3c7; padding: 4px 8px; border-radius: 6px; border: 1px dashed #f59e0b; }
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

            <div class="btn-export-group">
                <button class="btn-exp" style="background: #16a34a;" ${doc.statusManager !== "Approved by Manager" ? 'disabled title="Wajib diapprove terlebih dahulu"' : ''} onclick="if(window.opener) window.opener.exportPICA_Single('${doc.noSPP}')">
                    📊 Generate PICA (Excel)
                </button>
                <button class="btn-exp" style="background: #dc2626;" ${doc.statusManager !== "Approved by Manager" ? 'disabled title="Wajib diapprove terlebih dahulu"' : ''} onclick="if(window.opener) window.opener.exportLHA_Single('${doc.noSPP}')">
                    📄 Generate LHA (PDF)
                </button>
                <button class="btn-exp" style="background: #d97706;" onclick="if(window.opener) window.opener.exportPPT_Single('${doc.noSPP}')">
                    💻 Generate PPT
                </button>

                <div class="ppt-combine-wrapper">
                    <span style="font-weight: bold; font-size: 14px; color: #b45309;">➕ Gabung PPT:</span>
                    <select id="select-combine-project" style="font-size: 11px; padding: 4px; border-radius: 4px; border: 1px solid #d97706;">
                        <option value="">-- Pilih Project Lain --</option>
                        ${otherProjectOptions}
                    </select>
                    <button onclick="combineSelectedFromTab('${doc.noSPP}')" style="background: #b45309; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; cursor: pointer;">
                        Gabung & Generate Slide
                    </button>
                </div>
            </div>

            <div class="meta-grid">
                <div><small style="color: #64748b; font-weight: bold;">NO. SURAT TUGAS / SPP</small><br><b style="color: #0284c7;">${doc.noSPP}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">NO. LHA</small><br><b style="color: #dc2626;">${doc.noLHA}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">NO. PICA</small><br><b style="color: #16a34a;">${doc.noPICA}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">LEAD AUDITOR</small><br><b>${doc.auditor}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">REGIONAL HEAD</small><br><b>${doc.regionalHead}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">TANGGAL SELESAI AUDIT</small><br><b style="color: #ef4444;">${tglSelesaiFormatted}</b></div>
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

        <script>
            function combineSelectedFromTab(primarySPP) {
                const targetSPP = document.getElementById('select-combine-project').value;
                if (!targetSPP) return alert("Pilih project lain yang ingin digabungkan!");
                if (window.opener && window.opener.combineTwoProjectsPPT) {
                    window.opener.combineTwoProjectsPPT(primarySPP, targetSPP);
                }
            }
        </script>
    </body>
    </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(detailHTML);
    win.document.close();
}

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

                const tglMulai = findVal(['mulai', 'tgl mulai']) || "-";
                const tglSelesai = findVal(['selesai', 'tgl selesai']) || "-";

                const newDoc = {
                    id: Date.now() + idx,
                    jenis: jenis,
                    year: new Date().getFullYear(),
                    noSPP: noSPP,
                    noLHA: findVal(['lha', 'no. lha']) || "-",
                    noPICA: findVal(['pica', 'no. pica']) || "-",
                    tanggalStart: formatIndonesianDate(new Date()),
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
        currentUserEmail = user.email.toLowerCase();
        
        const isAuthorized = listAdminManagerEmails.includes(currentUserEmail) || 
                             currentUserEmail.includes('manager') || 
                             currentUserEmail.includes('head') || 
                             currentUserEmail.includes('admin');

        currentUserRole = isAuthorized ? "manager" : "auditor";

        document.getElementById('display-user-email').innerText = user.email;
        document.getElementById('display-user-role').innerText = currentUserRole === "manager" ? "ADMIN / MANAGER" : "AUDITOR";
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
