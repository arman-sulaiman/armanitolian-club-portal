import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates an institutional PDF matching The Armanitolian's Club official format.
 * Returns { blobUrl, fileName } for both in-browser View PDF and Download PDF.
 */
export function buildReportPdf(reportData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const s = reportData.settings || {};

  const clubTitle = (s.clubNameEn || "THE ARMANITOLIAN'S CLUB").toUpperCase();
  const motto = s.mottoEn || "An initiative of Armanitola Govt. High School's Ex-Students";
  const estd = s.establishedText || 'Estd. 2025';
  const contactLine = `Phone: ${s.contactPhone || '+8801700000000'}, E-mail: ${s.contactEmail || 'armanitolian@gmail.com'}, Webpage: ${s.clubWebpage || 'armanitolianclub.org'}`;

  // Official Letterhead on Page 1
  let y = 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(0, 75, 118); // #004B76
  doc.text(clubTitle, pageWidth / 2, y, { align: 'center' });

  y += 18;
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(motto, pageWidth / 2, y, { align: 'center' });

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(estd, pageWidth / 2, y, { align: 'center' });

  y += 15;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(contactLine, pageWidth / 2, y, { align: 'center' });

  y += 10;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.75);
  doc.line(marginX, y, pageWidth - marginX, y);

  // Generated Date (Right-aligned)
  y += 18;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);
  doc.text(`Generated Date: ${reportData.generatedDate}`, pageWidth - marginX, y, { align: 'right' });

  y += 12;

  const drawBoxedHeading = (text, startY) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    const boxW = 148;
    const boxH = 24;
    const boxX = (pageWidth - boxW) / 2;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.rect(boxX, startY, boxW, boxH);
    doc.setTextColor(0, 0, 0);
    doc.text(text, pageWidth / 2, startY + 15.5, { align: 'center' });
    return startY + boxH + 14;
  };

  if (reportData.reportType === 'monthly_payment') {
    // Summary Box Table
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      styles: {
        font: 'times',
        fontSize: 10.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.7,
        cellPadding: 6,
      },
      head: [
        [
          {
            content: 'Monthly Payment Report',
            colSpan: 4,
            styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 255, 255] },
          },
        ],
      ],
      body: [
        [
          'Month',
          { content: reportData.monthLabel, styles: { fontStyle: 'bold' } },
          'Total Paid',
          { content: `${Number(reportData.totalPaid || 0)}/- BDT`, styles: { fontStyle: 'bold' } },
        ],
        [
          'Batch',
          { content: reportData.batchLabel, styles: { fontStyle: 'bold' } },
          'Due Amount',
          { content: `${Number(reportData.totalDue || 0)}/- BDT`, styles: { fontStyle: 'bold' } },
        ],
      ],
    });

    y = doc.lastAutoTable.finalY + 18;
    y = drawBoxedHeading('Payment Paid List', y);

    const paidRows =
      (reportData.paidList || []).length > 0
        ? reportData.paidList.map((r) => [
            r.no,
            r.name,
            r.batch,
            r.paymentType,
            String(r.amount),
            r.method,
          ])
        : [['—', 'No verified payments received in this month', '—', '—', '0', '—']];

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX, bottom: 54 },
      theme: 'grid',
      styles: {
        font: 'times',
        fontSize: 10,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.7,
        cellPadding: 5.5,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 34 },
        1: { halign: 'left' },
        2: { halign: 'center', cellWidth: 50 },
        3: { halign: 'center' },
        4: { halign: 'center', cellWidth: 62 },
        5: { halign: 'center', cellWidth: 58 },
      },
      head: [['No.', 'Name', 'Batch', 'Payment Type', 'Amount', 'Method']],
      body: paidRows,
    });

    // Page 2: Payment Due List
    doc.addPage();
    let y2 = 54;
    y2 = drawBoxedHeading('Payment Due List', y2);

    const dueRows =
      (reportData.dueList || []).length > 0
        ? reportData.dueList.map((r) => [r.no, r.name, r.batch, r.paymentType, String(r.dueAmount)])
        : [['—', 'No pending dues for this selection', '—', '—', '0']];

    autoTable(doc, {
      startY: y2,
      margin: { left: marginX, right: marginX, bottom: 54 },
      theme: 'grid',
      styles: {
        font: 'times',
        fontSize: 10,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.7,
        cellPadding: 5.5,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 34 },
        1: { halign: 'left' },
        2: { halign: 'center', cellWidth: 55 },
        3: { halign: 'center' },
        4: { halign: 'center', cellWidth: 75 },
      },
      head: [['No.', 'Name', 'Batch', 'Payment Type', 'Due Amount']],
      body: dueRows,
    });
  } else {
    // Member List Report
    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: 'grid',
      styles: {
        font: 'times',
        fontSize: 10.5,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.7,
        cellPadding: 6,
      },
      head: [
        [
          {
            content: 'Official Member Directory Report',
            colSpan: 4,
            styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 255, 255] },
          },
        ],
      ],
      body: [
        [
          'Category / Batch',
          { content: reportData.batchLabel, styles: { fontStyle: 'bold' } },
          'Total Members',
          { content: String(reportData.totalMembers || 0), styles: { fontStyle: 'bold' } },
        ],
        [
          'Member Type',
          { content: reportData.memberTypeLabel, styles: { fontStyle: 'bold' } },
          'Status',
          { content: 'Approved', styles: { fontStyle: 'bold' } },
        ],
      ],
    });

    y = doc.lastAutoTable.finalY + 18;
    y = drawBoxedHeading('Approved Member List', y);

    const mRows =
      (reportData.rows || []).length > 0
        ? reportData.rows.map((r) => [
            r.no,
            r.memberId,
            r.name,
            r.batch,
            r.category,
            r.memberType,
            r.phone,
            r.bloodGroup,
          ])
        : [['—', '—', 'No members matched the selected criteria', '—', '—', '—', '—', '—']];

    autoTable(doc, {
      startY: y,
      margin: { left: marginX, right: marginX, bottom: 54 },
      theme: 'grid',
      styles: {
        font: 'times',
        fontSize: 9,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.65,
        cellPadding: 4.5,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 26 },
        1: { halign: 'center', cellWidth: 74 },
        3: { halign: 'center', cellWidth: 38 },
        7: { halign: 'center', cellWidth: 34 },
      },
      head: [['No.', 'Club ID', 'Name', 'Batch', 'Category', 'Member Type', 'Phone', 'Blood']],
      body: mRows,
    });
  }

  // Official Footer on Every Page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text('This is an auto-generated Report by System', marginX, pageHeight - 32);

    doc.setFont('times', 'bold');
    doc.text(`Page ${i}`, pageWidth - marginX, pageHeight - 32, { align: 'right' });
  }

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const slug =
    reportData.reportType === 'monthly_payment'
      ? `Monthly_Payment_Report_${reportData.month}`
      : `Member_List_Report_${stamp}`;
  const fileName = `The_Armanitolians_Club_${slug}.pdf`;

  return { blobUrl, fileName };
}

/**
 * Generates an official Membership Fee Progress Report PDF for an individual member (OTP-verified).
 */
export function buildMemberProgressPdf(report) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const s = report.settings || {};

  const clubTitle = (s.clubNameEn || "THE ARMANITOLIAN'S CLUB").toUpperCase();
  const motto = s.mottoEn || "An initiative of Armanitola Govt. High School's Ex-Students";
  const estd = s.establishedText || 'Estd. 2025';
  const contactLine = `Phone: ${s.contactPhone || '+8801700000000'}, E-mail: ${s.contactEmail || 'armanitolian@gmail.com'}, Webpage: ${s.clubWebpage || 'armanitolianclub.org'}`;

  let y = 50;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(0, 75, 118);
  doc.text(clubTitle, pageWidth / 2, y, { align: 'center' });

  y += 18;
  doc.setFont('times', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(motto, pageWidth / 2, y, { align: 'center' });

  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(estd, pageWidth / 2, y, { align: 'center' });

  y += 15;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(contactLine, pageWidth / 2, y, { align: 'center' });

  y += 10;
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.75);
  doc.line(marginX, y, pageWidth - marginX, y);

  y += 18;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Generated Date: ${report.generatedDate}`, pageWidth - marginX, y, { align: 'right' });

  y += 12;

  // Member Progress Summary Box
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 10,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.7,
      cellPadding: 6,
    },
    head: [
      [
        {
          content: 'Membership Fee Progress Report',
          colSpan: 4,
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 255, 255], fontSize: 11.5 },
        },
      ],
    ],
    body: [
      [
        'Member Name',
        { content: report.name, styles: { fontStyle: 'bold' } },
        'Membership ID',
        { content: report.memberId, styles: { fontStyle: 'bold' } },
      ],
      [
        'SSC Batch',
        { content: String(report.batch), styles: { fontStyle: 'bold' } },
        'Subscription Category',
        { content: report.subscriptionCategory, styles: { fontStyle: 'bold' } },
      ],
      [
        'Membership Type',
        { content: report.membershipType, styles: { fontStyle: 'bold' } },
        'Total Subscription',
        { content: `${Number(report.totalPayable || 0)}/- BDT`, styles: { fontStyle: 'bold' } },
      ],
      [
        'Total Paid',
        { content: `${Number(report.totalPaid || 0)}/- BDT`, styles: { fontStyle: 'bold' } },
        'Total Due',
        { content: `${Number(report.totalDue || 0)}/- BDT`, styles: { fontStyle: 'bold' } },
      ],
      [
        'Paid Installments',
        { content: String(report.paidInstallmentsCount || 0), styles: { fontStyle: 'bold' } },
        'Due Installments',
        { content: String(report.dueInstallmentsCount || 0), styles: { fontStyle: 'bold' } },
      ],
    ],
  });

  y = doc.lastAutoTable.finalY + 20;

  // Boxed Section Title
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  const boxW = 190;
  const boxH = 24;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.rect((pageWidth - boxW) / 2, y, boxW, boxH);
  doc.text('Paid Payment Information', pageWidth / 2, y + 15.5, { align: 'center' });
  y += boxH + 14;

  const payRows =
    (report.paidPayments || []).length > 0
      ? report.paidPayments.map((p) => [
          p.no,
          p.receiptNo,
          p.date,
          `${p.paymentType} (${p.month})`,
          p.method,
          p.transactionId,
          `${p.amount}/-`,
        ])
      : [['—', '—', '—', 'No verified payments recorded yet', '—', '—', '0/-']];

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX, bottom: 54 },
    theme: 'grid',
    styles: {
      font: 'times',
      fontSize: 9,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.65,
      cellPadding: 4.5,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 24 },
      1: { halign: 'center', cellWidth: 74 },
      2: { halign: 'center', cellWidth: 56 },
      6: { halign: 'right', cellWidth: 48 },
    },
    head: [['No.', 'Receipt No.', 'Date', 'Payment Details', 'Method', 'Trx ID', 'Amount']],
    body: payRows,
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text('This is an auto-generated Report by System', marginX, pageHeight - 32);
    doc.setFont('times', 'bold');
    doc.text(`Page ${i}`, pageWidth - marginX, pageHeight - 32, { align: 'right' });
  }

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const fileName = `Fee_Progress_Report_${report.memberId}.pdf`;
  return { blobUrl, fileName };
}
