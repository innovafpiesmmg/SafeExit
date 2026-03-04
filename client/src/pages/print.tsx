import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, FileDown, QrCode, GraduationCap } from "lucide-react";
import { differenceInYears } from "date-fns";
import QRCode from "qrcode";
import type { Student, Group } from "@shared/schema";

function StudentCard({ student, group, qrDataUrl }: { student: Student; group?: Group; qrDataUrl: string }) {
  const age = differenceInYears(new Date(), new Date(student.dateOfBirth));
  const isAdult = age >= 18;

  return (
    <div
      className="relative border border-border rounded-lg bg-card overflow-hidden"
      style={{ width: "85mm", height: "55mm" }}
      data-testid={`carnet-${student.id}`}
    >
      <div className="absolute inset-0 grid grid-cols-[35%_1fr] h-full">
        <div className="flex flex-col items-center justify-center bg-primary/5 p-2 border-r border-border">
          <Avatar className="w-16 h-16 mb-1.5">
            <AvatarImage src={student.photoUrl || undefined} />
            <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
              {student.firstName[0]}{student.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <p className="text-[8px] text-muted-foreground text-center">SafeExit</p>
        </div>
        <div className="flex flex-col justify-between p-2.5">
          <div>
            <div className="flex items-start justify-between gap-1">
              <p className="text-[11px] font-bold leading-tight line-clamp-2" style={{ maxWidth: "calc(100% - 20px)" }}>
                {student.firstName} {student.lastName}
              </p>
              {isAdult && (
                <span className="flex-shrink-0 bg-primary text-primary-foreground text-[7px] font-bold px-1 py-0.5 rounded">+18</span>
              )}
            </div>
            <div className="mt-1 space-y-0.5">
              <p className="text-[9px] text-muted-foreground">{student.course}</p>
              <p className="text-[9px] font-medium">{group?.name || ""}</p>
            </div>
          </div>
          <div className="flex items-end justify-between">
            <div className="text-[7px] text-muted-foreground">
              ID: {student.id}
            </div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR" className="w-14 h-14" />
            )}
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

      doc.setDrawColor(200);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3);

      doc.setFillColor(245, 247, 250);
      doc.roundedRect(x, y, cardWidth * 0.35, cardHeight, 3, 0, "F");

      doc.setFontSize(6);
      doc.setTextColor(150);
      doc.text("SafeExit", x + cardWidth * 0.175, y + cardHeight - 4, { align: "center" });

      const initials = `${student.firstName[0]}${student.lastName[0]}`;
      doc.setFontSize(16);
      doc.setTextColor(66, 133, 244);
      doc.text(initials, x + cardWidth * 0.175, y + 25, { align: "center" });

      const textX = x + cardWidth * 0.38;
      doc.setFontSize(9);
      doc.setTextColor(30);
      const name = `${student.firstName} ${student.lastName}`;
      const truncatedName = name.length > 25 ? name.slice(0, 22) + "..." : name;
      doc.text(truncatedName, textX, y + 10);

      if (age >= 18) {
        doc.setFillColor(66, 133, 244);
        doc.roundedRect(textX + doc.getTextWidth(truncatedName) + 2, y + 6, 8, 5, 1, 1, "F");
        doc.setFontSize(5);
        doc.setTextColor(255);
        doc.text("+18", textX + doc.getTextWidth(truncatedName) + 3.5, y + 9.5);
      }

      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(student.course, textX, y + 16);
      doc.setFontSize(8);
      doc.setTextColor(60);
      doc.text(group?.name || "", textX, y + 22);
      doc.setFontSize(5);
      doc.setTextColor(150);
      doc.text(`ID: ${student.id}`, textX, y + cardHeight - 4);

      if (qrUrls[student.id]) {
        doc.addImage(qrUrls[student.id], "PNG", x + cardWidth - 18, y + cardHeight - 18, 15, 15);
      }
    }

    doc.save("carnets_safeexit.pdf");
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
            Generar PDF ({selectedStudents.size})
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
                <StudentCard student={student} group={group} qrDataUrl={qrUrls[student.id] || ""} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
