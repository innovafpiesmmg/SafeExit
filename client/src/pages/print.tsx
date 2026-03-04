import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, FileDown, GraduationCap, Smartphone, ShieldCheck } from "lucide-react";
import { differenceInYears } from "date-fns";
import QRCode from "qrcode";
import type { Student, Group } from "@shared/schema";

function StudentCard({ student, group, qrDataUrl, schoolName, academicYear }: { student: Student; group?: Group; qrDataUrl: string; schoolName: string; academicYear: string }) {
  const age = differenceInYears(new Date(), new Date(student.dateOfBirth));
  const isAdult = age >= 18;

  return (
    <div
      className="relative rounded-xl overflow-hidden shadow-md border"
      style={{ width: "85mm", height: "55mm" }}
      data-testid={`carnet-${student.id}`}
    >
      <div className="absolute inset-0 flex flex-col h-full">
        <div className="bg-primary text-primary-foreground px-3 py-1 flex flex-col">
          {schoolName && (
            <span className="text-[7px] font-semibold text-center opacity-90 leading-tight">{schoolName}</span>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span className="text-[8px] font-bold tracking-wide">SafeExit</span>
            </div>
            <span className="text-[6px] opacity-80">
              {academicYear ? `Curso ${academicYear}` : "Carnet de Alumno"}
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-stretch bg-card">
          <div className="flex flex-col items-center justify-center px-3 py-2" style={{ width: "35%" }}>
            <Avatar className="w-14 h-14 border-2 border-primary/20 shadow-sm">
              <AvatarImage src={student.photoUrl || undefined} />
              <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">
                {student.firstName[0]}{student.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1 mt-1.5">
              <Badge variant="secondary" className="text-[7px] px-1 py-0">
                <GraduationCap className="w-2.5 h-2.5 mr-0.5" />
                {group?.name}
              </Badge>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between py-2 pr-3">
            <div>
              <div className="flex items-start gap-1">
                <p className="text-[11px] font-bold leading-tight line-clamp-2">
                  {student.firstName} {student.lastName}
                </p>
                {isAdult && (
                  <span className="flex-shrink-0 bg-primary text-primary-foreground text-[7px] font-bold px-1 py-0.5 rounded mt-0.5">+18</span>
                )}
              </div>
              <p className="text-[8px] text-muted-foreground mt-0.5">{student.course}</p>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-[6px] text-muted-foreground">ID: {student.id}</p>
              {qrDataUrl && (
                <div className="bg-white p-0.5 rounded border shadow-inner">
                  <img src={qrDataUrl} alt="QR" className="w-[52px] h-[52px]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrintPage() {
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set());
  const [qrUrls, setQrUrls] = useState<Record<number, string>>({});

  const { data: students, isLoading } = useQuery<Student[]>({ queryKey: ["/api/students"] });
  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/groups"] });
  const { data: settings } = useQuery<Record<string, string>>({ queryKey: ["/api/settings"] });

  const schoolName = settings?.schoolName || "";
  const academicYear = settings?.academicYear || "";

  const filtered = selectedGroup === "all"
    ? students || []
    : students?.filter(s => s.groupId === parseInt(selectedGroup)) || [];

  useEffect(() => {
    const generateQRs = async () => {
      if (!students) return;
      const urls: Record<number, string> = {};
      for (const s of students) {
        urls[s.id] = await QRCode.toDataURL(s.qrCode, { width: 120, margin: 1 });
      }
      setQrUrls(urls);
    };
    generateQRs();
  }, [students]);

  const toggleStudent = (id: number) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedStudents.size === filtered.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filtered.map(s => s.id)));
    }
  };

  const handlePrint = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const printStudents = filtered.filter(s => selectedStudents.has(s.id));
    const cardWidth = 85;
    const cardHeight = 55;
    const marginX = (210 - 2 * cardWidth) / 3;
    const marginY = (297 - 5 * cardHeight) / 6;

    const headerH = 8;
    const primaryR = 37, primaryG = 99, primaryB = 235;

    for (let i = 0; i < printStudents.length; i++) {
      if (i > 0 && i % 10 === 0) doc.addPage();
      const pageIdx = i % 10;
      const col = pageIdx % 2;
      const row = Math.floor(pageIdx / 2);
      const x = marginX + col * (cardWidth + marginX);
      const y = marginY + row * (cardHeight + marginY);
      const student = printStudents[i];
      const group = groups?.find(g => g.id === student.groupId);
      const age = differenceInYears(new Date(), new Date(student.dateOfBirth));

      doc.setDrawColor(210);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5);

      const actualHeaderH = schoolName ? headerH + 4 : headerH;

      doc.setFillColor(primaryR, primaryG, primaryB);
      doc.rect(x + 0.15, y + 0.15, cardWidth - 0.3, actualHeaderH, "F");

      let headerTextY = y + 3;
      if (schoolName) {
        doc.setFontSize(5.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        const truncSchool = schoolName.length > 45 ? schoolName.slice(0, 42) + "..." : schoolName;
        doc.text(truncSchool, x + cardWidth / 2, headerTextY + 1.5, { align: "center" });
        headerTextY += 4;
      }

      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("SafeExit", x + 4, headerTextY + 2.5);

      doc.setFontSize(5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(255, 255, 255);
      const headerRightText = academicYear ? `Curso ${academicYear}` : "Carnet de Alumno";
      doc.text(headerRightText, x + cardWidth - 4, headerTextY + 2.5, { align: "right" });

      const photoSectionW = cardWidth * 0.32;
      const contentY = y + actualHeaderH + 2;
      const contentH = cardHeight - actualHeaderH - 2;

      doc.setFillColor(248, 250, 252);
      doc.rect(x + 0.15, y + actualHeaderH, photoSectionW - 0.15, contentH + 2 - 0.15, "F");

      const photoCenterX = x + photoSectionW / 2;
      const photoCenterY = contentY + contentH / 2 - 4;
      const photoR = 8;

      doc.setDrawColor(primaryR, primaryG, primaryB);
      doc.setLineWidth(0.6);
      doc.circle(photoCenterX, photoCenterY, photoR + 0.5);

      if (student.photoUrl) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = student.photoUrl!;
          });
          const canvas = document.createElement("canvas");
          const size = 200;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d")!;
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.clip();
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const dataUrl = canvas.toDataURL("image/png");
          doc.addImage(dataUrl, "PNG", photoCenterX - photoR, photoCenterY - photoR, photoR * 2, photoR * 2);
        } catch {
          doc.setFontSize(14);
          doc.setTextColor(primaryR, primaryG, primaryB);
          doc.setFont("helvetica", "bold");
          doc.text(`${student.firstName[0]}${student.lastName[0]}`, photoCenterX, photoCenterY + 2, { align: "center" });
        }
      } else {
        doc.setFontSize(14);
        doc.setTextColor(primaryR, primaryG, primaryB);
        doc.setFont("helvetica", "bold");
        doc.text(`${student.firstName[0]}${student.lastName[0]}`, photoCenterX, photoCenterY + 2, { align: "center" });
      }

      doc.setFillColor(primaryR, primaryG, primaryB);
      doc.setTextColor(255);
      const groupLabel = group?.name || "";
      doc.roundedRect(photoCenterX - 8, photoCenterY + photoR + 2, 16, 4, 1, 1, "F");
      doc.setFontSize(5);
      doc.setFont("helvetica", "bold");
      doc.text(groupLabel, photoCenterX, photoCenterY + photoR + 4.8, { align: "center" });

      const textX = x + photoSectionW + 3;
      const textMaxW = cardWidth - photoSectionW - 6;

      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      const name = `${student.firstName} ${student.lastName}`;
      const truncatedName = name.length > 22 ? name.slice(0, 19) + "..." : name;
      doc.text(truncatedName, textX, contentY + 5);

      if (age >= 18) {
        const nameW = doc.getTextWidth(truncatedName);
        doc.setFillColor(primaryR, primaryG, primaryB);
        doc.roundedRect(textX + nameW + 1.5, contentY + 1.5, 7, 4, 1, 1, "F");
        doc.setFontSize(5);
        doc.setTextColor(255);
        doc.setFont("helvetica", "bold");
        doc.text("+18", textX + nameW + 3, contentY + 4.5);
      }

      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text(student.course, textX, contentY + 10);

      doc.setFontSize(5);
      doc.setTextColor(160);
      doc.text(`ID: ${student.id}`, textX, y + cardHeight - 3);

      if (qrUrls[student.id]) {
        const qrSize = 17;
        const qrX = x + cardWidth - qrSize - 3;
        const qrY = y + cardHeight - qrSize - 3;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(230);
        doc.setLineWidth(0.2);
        doc.roundedRect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, 1, 1, "FD");
        doc.addImage(qrUrls[student.id], "PNG", qrX, qrY, qrSize, qrSize);
      }
    }

    doc.save("carnets_safeexit.pdf");
  };

  const handleDigitalPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const printStudents = filtered.filter(s => selectedStudents.has(s.id) && s.carnetToken);
    const baseUrl = window.location.origin;
    const perPage = 8;
    const cols = 2;
    const cellW = 85;
    const cellH = 65;
    const marginX = (210 - cols * cellW) / (cols + 1);
    const rows = 4;
    const marginY = (297 - rows * cellH) / (rows + 1);

    for (let i = 0; i < printStudents.length; i++) {
      if (i > 0 && i % perPage === 0) doc.addPage();
      const pageIdx = i % perPage;
      const col = pageIdx % cols;
      const row = Math.floor(pageIdx / cols);
      const x = marginX + col * (cellW + marginX);
      const y = marginY + row * (cellH + marginY);
      const student = printStudents[i];

      doc.setDrawColor(200);
      doc.roundedRect(x, y, cellW, cellH, 2, 2);

      let digitalY = y + 5;
      if (schoolName) {
        doc.setFontSize(6);
        doc.setTextColor(60);
        doc.setFont("helvetica", "bold");
        doc.text(schoolName, x + cellW / 2, digitalY, { align: "center" });
        digitalY += 4;
      }

      doc.setFontSize(9);
      doc.setTextColor(30);
      doc.setFont("helvetica", "bold");
      const name = `${student.firstName} ${student.lastName}`;
      const truncated = name.length > 30 ? name.slice(0, 27) + "..." : name;
      doc.text(truncated, x + cellW / 2, digitalY + 3, { align: "center" });

      const group = groups?.find(g => g.id === student.groupId);
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      const courseGroup = `${student.course} — ${group?.name || ""}`;
      doc.text(academicYear ? `${courseGroup} — Curso ${academicYear}` : courseGroup, x + cellW / 2, digitalY + 8, { align: "center" });

      const carnetUrl = `${baseUrl}/carnet/${student.carnetToken}`;
      const qrData = await QRCode.toDataURL(carnetUrl, { width: 200, margin: 1 });
      doc.addImage(qrData, "PNG", x + (cellW - 35) / 2, y + 16, 35, 35);

      doc.setFontSize(5);
      doc.setTextColor(130);
      doc.text("Escanea con tu móvil para abrir tu carnet digital", x + cellW / 2, y + 56, { align: "center" });

      doc.setFontSize(4);
      doc.text(carnetUrl, x + cellW / 2, y + 61, { align: "center" });
    }

    doc.save("carnets_digitales_safeexit.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-print-title">Impresión de Carnets</h1>
          <p className="text-muted-foreground text-sm mt-1">Genera carnets con QR en formato A4 (2x5)</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedGroup} onValueChange={v => { setSelectedGroup(v); setSelectedStudents(new Set()); }}>
            <SelectTrigger className="w-48" data-testid="select-print-group">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grupos</SelectItem>
              {groups?.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handlePrint} disabled={selectedStudents.size === 0} data-testid="button-generate-pdf">
            <FileDown className="w-4 h-4 mr-2" />
            Carnets PDF ({selectedStudents.size})
          </Button>
          <Button onClick={handleDigitalPdf} disabled={selectedStudents.size === 0 || !filtered.some(s => selectedStudents.has(s.id) && s.carnetToken)} variant="outline" data-testid="button-generate-digital-pdf">
            <Smartphone className="w-4 h-4 mr-2" />
            Enlaces QR ({filtered.filter(s => selectedStudents.has(s.id) && s.carnetToken).length})
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-1">
        <Checkbox
          checked={filtered.length > 0 && selectedStudents.size === filtered.length}
          onCheckedChange={selectAll}
          data-testid="checkbox-select-all"
        />
        <span className="text-sm text-muted-foreground">
          Seleccionar todos ({filtered.length})
        </span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[55mm]" />)}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Printer className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">No hay alumnos para imprimir</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(student => {
            const group = groups?.find(g => g.id === student.groupId);
            return (
              <div key={student.id} className="flex items-start gap-3">
                <Checkbox
                  checked={selectedStudents.has(student.id)}
                  onCheckedChange={() => toggleStudent(student.id)}
                  className="mt-5"
                  data-testid={`checkbox-student-${student.id}`}
                />
                <StudentCard student={student} group={group} qrDataUrl={qrUrls[student.id] || ""} schoolName={schoolName} academicYear={academicYear} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
