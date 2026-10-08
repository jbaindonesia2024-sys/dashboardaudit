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

function addBusinessDays(startDateStr, daysToAdd) {
    if (!startDateStr) return "-";
    let date = new Date(startDateStr);
    if (isNaN(date.getTime())) return "-";
    
    let added = 0;
    while (added < daysToAdd) {
        date.setDate(date.getDate() + 1);
        if (date.getDay() !== 0 && date.getDay() !== 6) {
            added++;
        }
    }
    return formatIndonesianDate(date);
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

function syncSinglePenomoranToFirebase(docObj) {
    if (typeof database !== 'undefined' && database && database.ref) {
        database.ref('dbPenomoran/' + docObj.id).set(docObj);
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

function getNextSPPSequence(targetYear) {
    const listInYear = dbPenomoran.filter(d => d.year === targetYear && d.sppSeq);
    if (listInYear.length === 0) return 1;
    return Math.max(...listInYear.map(d => d.sppSeq)) + 1;
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

    let previewSPP = (jenis === "Investigasi") 
        ? `${seqStr}/FOC-SRT TUGAS/${monthRoman}/${targetYear}` 
        : `${seqStr}/SPP/JBA-IA/${monthRoman}/${targetYear}`;

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
    const tglPelaksanaan = `${tglMulai} s.d ${tglSelesai}`;
    const dueDateProject = addBusinessDays(tglSelesai, 4);

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

                const duplicateLHAObj = newLHA !== "-" && newLHA !== "N/A (Investigasi)" && dbPenomoran.find(x => x.id != editId && x.noLHA.toLowerCase() === newLHA.toLowerCase());
                if (duplicateLHAObj) {
                    return alert(`⚠️ ERROR EDIT MANUAL:\nNomor LHA '${newLHA}' telah terregistrasi pada Project '${duplicateLHAObj.judul}'!`);
                }

                const duplicatePICAObj = newPICA !== "-" && newPICA !== "N/A (Investigasi)" && dbPenomoran.find(x => x.id != editId && x.noPICA.toLowerCase() === newPICA.toLowerCase());
                if (duplicatePICAObj) {
                    return alert(`⚠️️ ERROR EDIT MANUAL:\nNomor PICA '${newPICA}' telah terregistrasi pada Project '${duplicatePICAObj.judul}'!`);
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
                tglPelaksanaan: tglPelaksanaan,
                dueDateProject: dueDateProject,
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

        let autoSPP = (jenis === "Investigasi") 
            ? `${seqStr}/FOC-SRT TUGAS/${monthRoman}/${targetYear}` 
            : `${seqStr}/SPP/JBA-IA/${monthRoman}/${targetYear}`;

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
            tglSelesai: tglSelesai,
            dueDateProject: dueDateProject,
            judul: judul,
            regionalHead: regionalHead,
            jabatanRegionalHead: jabatanRegionalHead,
            periodeAudit: periode,
            tglPelaksanaan: tglPelaksanaan,
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
        alert(`Nomor Dokumen ${jenis} Berhasil Diterbitkan!\nNo. Surat: ${autoSPP}\nDue Date Project: ${dueDateProject}`);
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
    document.getElementById('p-jenis').value = doc.jenis;
    document.getElementById('p-judul').value = doc.judul;
    document.getElementById('p-periode').value = doc.periodeAudit;
    document.getElementById('p-auditor').value = doc.auditor;
    
    const members = (doc.auditMembers || '').split(', ');
    document.getElementById('p-member1').value = members[0] || '';
    document.getElementById('p-member2').value = members[1] || '';
    
    document.getElementById('p-email').value = doc.emailAuditee || '';
    document.getElementById('p-cc-email').value = doc.ccEmail || '';

    document.getElementById('container-edit-manual-spp').style.display = "block";
    document.getElementById('edit-manual-spp-val').value = doc.noSPP;
    document.getElementById('container-live-spp-preview').style.display = "none";
    document.getElementById('container-backdate-toggle').style.display = "none";

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

    if (confirm(`Apakah Anda yakin ingin MENGHAPUS PERMANEN nomor SPP berikut?\n\nNo. SPP: ${doc.noSPP}\nJudul: ${doc.judul}\n\nTindakan ini akan menghapus data hingga ke database!`)) {
        dbPenomoran = dbPenomoran.filter(item => item.id !== id);

        if (typeof database !== 'undefined' && database && database.ref) {
            database.ref('dbPenomoran/' + id).remove()
                .then(() => console.log("Berhasil dihapus dari Firebase Node"))
                .catch(err => console.error("Gagal hapus node Firebase:", err));
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
        alert("Surat Tugas bertanda tangan basah berhasil di-submit! Tombol Kirim Email Surat Tugas kini aktif.");
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
        ` Tanggal Pelaksanaan: ${doc.tglPelaksanaan}\n` +
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

function filterPenomoranTable() {
    const query = document.getElementById('search-penomoran').value.toLowerCase().trim();
    const filteredData = dbPenomoran.filter(item => {
        return (item.jenis && item.jenis.toLowerCase().includes(query)) ||
               (item.noSPP && item.noSPP.toLowerCase().includes(query)) ||
               (item.noLHA && item.noLHA.toLowerCase().includes(query)) ||
               (item.noPICA && item.noPICA.toLowerCase().includes(query)) ||
               (item.judul && item.judul.toLowerCase().includes(query)) ||
               (item.regionalHead && item.regionalHead.toLowerCase().includes(query));
    });
    renderPenomoranRows(filteredData);
}

function filterLogTable() {
    const query = document.getElementById('search-log').value.toLowerCase().trim();
    const filteredLogs = activityLogs.filter(log => {
        return log.timestamp.toLowerCase().includes(query) ||
               (log.userEmail && log.userEmail.toLowerCase().includes(query)) ||
               log.kategori.toLowerCase().includes(query) ||
               log.aktivitas.toLowerCase().includes(query) ||
               log.detailDoc.toLowerCase().includes(query);
    });
    renderLogRows(filteredLogs);
}

function handleFileUpload(e, auditType) {
    const file = e.target.files[0];
    if (!file) return;

    const selectElemId = auditType === 'Reguler' ? 'audit-select-nomor' : 'fraud-select-nomor';
    const selectElem = document.getElementById(selectElemId);
    
    if (!selectElem || selectElem.value === "" || selectElem.value === null) {
        alert("⚠️ Mohon pilih Target Project Audit terlebih dahulu sebelum mengunggah berkas!");
        e.target.value = "";
        return;
    }

    const targetList = dbPenomoran.filter(x => x.jenis === auditType);
    const selectedDoc = targetList[selectElem.value];

    if (!selectedDoc) {
        alert("⚠️ Target Project Audit tidak valid!");
        e.target.value = "";
        return;
    }

    const progressContainer = document.getElementById(auditType === 'Reguler' ? 'upload-progress-container-reguler' : 'upload-progress-container-fraud');
    const progressBarFill = document.getElementById(auditType === 'Reguler' ? 'upload-progress-bar-fill-reguler' : 'upload-progress-bar-fill-fraud');
    const progressText = document.getElementById(auditType === 'Reguler' ? 'upload-progress-text-reguler' : 'upload-progress-text-fraud');
    const infoBadge = document.getElementById(auditType === 'Reguler' ? 'file-info-badge-reguler' : 'file-info-badge-fraud');
    const infoFileName = document.getElementById(auditType === 'Reguler' ? 'info-file-name-reguler' : 'info-file-name-fraud');
    const infoFileRows = document.getElementById(auditType === 'Reguler' ? 'info-file-rows-reguler' : 'info-file-rows-fraud');

    progressContainer.style.display = 'block';
    infoBadge.style.display = 'none';
    progressBarFill.style.width = '20%';
    progressText.innerText = '20% Membaca berkas...';

    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
        reader.onload = function(evt) {
            try {
                progressBarFill.style.width = '70%';
                progressText.innerText = '70% Parsing JSON...';
                
                const parsedData = JSON.parse(evt.target.result);
                const rawFindings = Array.isArray(parsedData) ? parsedData : (parsedData.findings || [parsedData]);
                
                const normalizedFindings = rawFindings.map((item, idx) => ({
                    id: item.id || Date.now() + idx,
                    area: item.area || item.Area || item.proses || "-",
                    fakta: item.fakta || item.Fakta || item.finding || item.Judul || "-",
                    rootCause: item.rootCause || item.RootCause || item['Root Cause'] || item.akarMasalah || "-",
                    rekomendasi: item.rekomendasi || item.Rekomendasi || "-",
                    status: item.status || item.Status || "Open"
                }));

                saveUploadedFindings(selectedDoc.noSPP, auditType, normalizedFindings);

                progressBarFill.style.width = '100%';
                progressText.innerText = '100% Upload Selesai!';
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    infoBadge.style.display = 'block';
                    infoFileName.innerText = file.name;
                    infoFileRows.innerText = normalizedFindings.length;
                    alert(`✅ Summary Audit (${normalizedFindings.length} temuan) berhasil ter-upload ke project ${selectedDoc.noSPP}!`);
                }, 400);

            } catch (err) {
                alert("⚠️ Gagal membaca berkas JSON: " + err.message);
                progressContainer.style.display = 'none';
            }
        };
        reader.readAsText(file);
    } else {
        reader.onload = function(evt) {
            try {
                progressBarFill.style.width = '60%';
                progressText.innerText = '60% Parsing Excel / CSV...';

                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonRows = XLSX.utils.sheet_to_json(worksheet);

                const normalizedFindings = jsonRows.map((row, idx) => {
                    const findKey = (keywords) => {
                        const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
                        return key ? row[key] : null;
                    };

                    return {
                        id: Date.now() + idx,
                        area: findKey(['area', 'proses', 'bagian']) || "-",
                        fakta: findKey(['fakta', 'finding', 'temuan', 'judul']) || "-",
                        rootCause: findKey(['root', 'cause', 'akar', 'sebab']) || "-",
                        rekomendasi: findKey(['rekomendasi', 'saran', 'action']) || "-",
                        status: findKey(['status', 'pica']) || "Open"
                    };
                });

                saveUploadedFindings(selectedDoc.noSPP, auditType, normalizedFindings);

                progressBarFill.style.width = '100%';
                progressText.innerText = '100% Upload Selesai!';
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    infoBadge.style.display = 'block';
                    infoFileName.innerText = file.name;
                    infoFileRows.innerText = normalizedFindings.length;
                    alert(`✅ Summary Audit (${normalizedFindings.length} temuan) berhasil di-import ke project ${selectedDoc.noSPP}!`);
                }, 400);

            } catch (err) {
                alert("⚠️ Gagal memproses berkas Excel/CSV: " + err.message);
                progressContainer.style.display = 'none';
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function saveUploadedFindings(noSPP, auditType, findings) {
    if (auditType === 'Reguler') {
        auditDatabase = auditDatabase.filter(x => x.noSPP !== noSPP);
        findings.forEach(item => {
            auditDatabase.push({ ...item, noSPP: noSPP, updated_at: new Date().toISOString() });
        });
        syncAuditDbToFirebase();
    } else {
        fraudDatabase = fraudDatabase.filter(x => x.noSPP !== noSPP);
        findings.forEach(item => {
            fraudDatabase.push({ ...item, noSPP: noSPP, updated_at: new Date().toISOString() });
        });
        syncFraudDbToFirebase();
    }
    logActivity("Summary Audit", `Upload File Summary (${findings.length} temuan)`, noSPP);
    refreshUI();
}

function toggleFindingStatus(findingId, noSPP) {
    let targetObj = auditDatabase.find(x => x.id == findingId);
    if (!targetObj) {
        targetObj = fraudDatabase.find(x => x.id == findingId);
    }

    if (targetObj) {
        const oldStatus = targetObj.status || 'Open';
        targetObj.status = (oldStatus.toLowerCase() === 'open') ? 'Closed' : 'Open';
        
        syncAuditDbToFirebase();
        syncFraudDbToFirebase();
        logActivity("Summary Audit", `Ubah Status Temuan (${targetObj.status})`, noSPP);
        
        alert(`Status temuan berhasil diubah menjadi: ${targetObj.status}`);
        openAuditDetailWindow(noSPP);
    }
}

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

            <div class="meta-grid">
                <div><small style="color: #64748b; font-weight: bold;">NO. SURAT TUGAS / SPP</small><br><b style="color: #0284c7;">${doc.noSPP}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">NO. LHA</small><br><b style="color: #dc2626;">${doc.noLHA}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">NO. PICA</small><br><b style="color: #16a34a;">${doc.noPICA}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">LEAD AUDITOR</small><br><b>${doc.auditor}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">REGIONAL HEAD</small><br><b>${doc.regionalHead}</b></div>
                <div><small style="color: #64748b; font-weight: bold;">DUE DATE PROJECT</small><br><b style="color: #ef4444;">${doc.dueDateProject || '-'}</b></div>
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

function toggleManagerApproval(id) {
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

    const confirmed = confirm("Apakah Anda telah selesai melakukan verifikasi laporan untuk menerbitkan nomor LHA & PICA?");
    if (confirmed) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const monthRoman = toRoman(today.getMonth() + 1);

        if (doc.jenis === "Investigasi") {
            doc.statusManager = "Approved by Manager";
            doc.noLHA = "N/A (Investigasi)";
            doc.noPICA = "N/A (Investigasi)";
        } else {
            const nextLHASeq = getNextLHASequence(currentYear);
            const nextPICASeq = getNextPICASequence(currentYear);

            doc.lhaSeq = nextLHASeq;
            doc.noLHA = `${String(nextLHASeq).padStart(3, '0')}/IA/JBA/LHA/${monthRoman}/${currentYear}`;
            doc.picaSeq = nextPICASeq;
            doc.noPICA = `${String(nextPICASeq).padStart(3, '0')}/IA/JBA/PICA/${monthRoman}/${currentYear}`;
            doc.statusManager = "Approved by Manager";
        }

        logActivity("Summary Audit", "Otorisasi Approval Manager & Terbit LHA/PICA", doc.noSPP);
        syncPenomoranToFirebase();
        refreshUI();
        alert(`🎉 Summary Audit Disetujui!\n\nNomor Resmi Terbit:\n• No. LHA: ${doc.noLHA}\n• No. PICA: ${doc.noPICA}`);
    }
}

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
        <p style="margin-top: 15px;">Perihal Internal Audit Rutin</p>
        <p style="margin-top: 10px;">Dengan hormat,</p>
        <p>Sehubungan dengan pelaksanaan Internal Audit JBA, maka kami akan menugaskan:</p>

        <table class="meta-table">
            <tr><td class="label">Nama</td><td class="colon">:</td><td>${daftarAuditor}</td></tr>
            <tr><td class="label">Ruang Lingkup</td><td class="colon">:</td><td>Kegiatan Operasional Cabang/Hub</td></tr>
            <tr><td class="label">Cabang / Hub</td><td class="colon">:</td><td>${doc.judul}</td></tr>
            <tr><td class="label">Obyektif</td><td class="colon">:</td><td>Observasi Efektivitas serta Efisiensi Operasional Cabang/Hub</td></tr>
            <tr><td class="label">Periode Audit</td><td class="colon">:</td><td>${doc.periodeAudit}</td></tr>
            <tr><td class="label">Tanggal Pelaksanaan</td><td class="colon">:</td><td>${doc.tglPelaksanaan}</td></tr>
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
        "Tanggal Pelaksanaan": p.tglPelaksanaan,
        "Due Date Project (HK+4)": p.dueDateProject || "-",
        "Lead Auditor": p.auditor,
        "Audit Members": p.auditMembers,
        "Tanggal Terbit": p.tanggalStart,
        "Email Auditee": p.emailAuditee,
        "CC Email": p.ccEmail || "-",
        "Status Manager": p.statusManager
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Register_Penomoran");
    XLSX.writeFile(workbook, `Register_Penomoran_Dokumen_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function populateDropdowns() {
    const regulerList = dbPenomoran.filter(x => x.jenis === "Reguler");
    const regulerSelect = document.getElementById('audit-select-nomor');
    if (regulerSelect) {
        if (regulerList.length === 0) {
            regulerSelect.innerHTML = `<option value="">Belum ada project Reguler</option>`;
        } else {
            regulerSelect.innerHTML = regulerList.map((item, idx) => 
                `<option value="${idx}">[${item.noSPP}] ${item.judul}</option>`
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

// -------------------------------------------------------------
// RENDER DENGAN POSISI TOMBOL EDIT DI PERTAMA
// -------------------------------------------------------------
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
            <td><b style="color: var(--danger);">${item.dueDateProject || '-'}</b></td>
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
        tbodyLog.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">Belum ada riwayat aktivitas recorded.</td></tr>`;
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
    renderPenomoranRows(dbPenomoran);
    renderLogRows(activityLogs);

    const tbodyAudit = document.getElementById('table-audit-body');
    if (tbodyAudit) {
        const regulerProjects = dbPenomoran.filter(x => x.jenis === 'Reguler');

        if (regulerProjects.length === 0) {
            tbodyAudit.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 20px;">Belum ada project Reguler yang diterbitkan.</td></tr>`;
        } else {
            tbodyAudit.innerHTML = regulerProjects.map(item => {
                const isApproved = item.statusManager === "Approved by Manager";
                let approvalUI = `
                    <button class="${isApproved ? 'btn-approval-ok' : 'btn-approval-not'}" onclick="toggleManagerApproval(${item.id})" title="Klik untuk otorisasi approval & generate LHA/PICA">
                        ${isApproved ? 'Approved by Manager' : 'Not Approved'}
                    </button>
                `;

                return `
                <tr>
                    <td>
                        <span class="code-tag code-tag-spp" onclick="openAuditDetailWindow('${item.noSPP}', 'Reguler')" title="Klik untuk membuka detail di tab baru">
                            🔗 ${item.noSPP}
                        </span>
                    </td>
                    <td><span class="code-tag code-tag-lha">${item.noLHA}</span></td>
                    <td><span class="code-tag code-tag-pica">${item.noPICA}</span></td>
                    <td><b>${item.judul}</b></td>
                    <td>${item.auditor}</td>
                    <td><b style="color: var(--danger);">${item.dueDateProject || '-'}</b></td>
                    <td>${item.tanggalStart}</td>
                    <td>${approvalUI}</td>
                    <td>
                        <button class="btn btn-warning" onclick="triggerOutlookReminder('Reguler')" style="padding: 4px 8px; font-size: 11px; width: auto;">📧 Reminder</button>
                    </td>
                </tr>
                `;
            }).join('');
        }
    }

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
                    <td>${item.tanggalStart}</td>
                    <td><span class="badge bg-approved">${item.statusManager}</span></td>
                </tr>
            `).join('');
        }
    }
}

initTodayDate();
autoFillAuditeeEmail();

// -------------------------------------------------------------
// FIREBASE AUTH & REALTIME DATABASE LISTENERS
// -------------------------------------------------------------
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
