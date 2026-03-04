import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Camera, Search, LogOut, GraduationCap, QrCode, Share2, Copy, Check, Users, AlertCircle, ImagePlus, ShieldCheck,
} from "lucide-react";
import { differenceInYears } from "date-fns";
import QRCode from "qrcode";
import type { Student, Group } from "@shared/schema";

export default function TutorView() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [shareStudent, setShareStudent] = useState<Student | null>(null);
  const [shareQrUrl, setShareQrUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [photoTargetId, setPhotoTargetId] = useState<number | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

  const { data, isLoading, isError } = useQuery<{ students: Student[]; group: Group }>({
    queryKey: ["/api/tutor/students"],
  });

  const students = data?.students || [];
  const group = data?.group;

  const filtered = students.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const handlePhoto = (studentId: number) => {
    setPhotoTargetId(studentId);
    setPhotoDialogOpen(true);
  };

  const chooseCamera = () => {
    setPhotoDialogOpen(false);
    setTimeout(() => cameraInputRef.current?.click(), 100);
  };

  const chooseGallery = () => {
    setPhotoDialogOpen(false);
    setTimeout(() => galleryInputRef.current?.click(), 100);
  };

  const uploadPhoto = useCallback(async (file: File) => {
    if (!photoTargetId) return;
    setUploading(photoTargetId);
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const res = await fetch(`/api/tutor/students/${photoTargetId}/photo`, {
        method: "PATCH",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tutor/students"] });
      toast({ title: "Foto actualizada" });
    } catch (err: any) {
      toast({ title: "Error subiendo foto", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
      setPhotoTargetId(null);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }, [photoTargetId, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhoto(file);
  };

  const handleShare = async (student: Student) => {
    setShareStudent(student);
    setCopied(false);
    const carnetUrl = `${window.location.origin}/carnet/${student.carnetToken}`;
    const qr = await QRCode.toDataURL(carnetUrl, { width: 300, margin: 2 });
    setShareQrUrl(qr);
  };

  const copyLink = () => {
    if (!shareStudent) return;
    navigator.clipboard.writeText(`${window.location.origin}/carnet/${shareStudent.carnetToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <div>
              <span className="font-bold text-sm">{group?.name || "Mi Grupo"}</span>
              <span className="text-xs text-muted-foreground ml-2">{user?.fullName}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/guard")} data-testid="button-tutor-guard-mode">
              <ShieldCheck className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} data-testid="button-tutor-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {students.length} alumnos
          </Badge>
          {group && (
            <Badge variant="outline" className="text-xs">{group.course}</Badge>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar alumno..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-tutor-search"
          />
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30 text-destructive" />
              <p className="font-medium">Error al cargar los datos</p>
              <p className="text-sm mt-1">Comprueba tu conexión e inténtalo de nuevo.</p>
            </CardContent>
          </Card>
        ) : !group ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No tienes un grupo asignado</p>
              <p className="text-sm mt-1">Contacta con el administrador para que te asigne un grupo.</p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">{search ? "No se encontraron alumnos" : "No hay alumnos en este grupo"}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(student => {
              const age = differenceInYears(new Date(), new Date(student.dateOfBirth));
              return (
                <Card key={student.id} data-testid={`card-tutor-student-${student.id}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="w-14 h-14">
                          <AvatarImage src={student.photoUrl || undefined} />
                          <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                            {student.firstName[0]}{student.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          onClick={() => handlePhoto(student.id)}
                          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
                          data-testid={`button-photo-${student.id}`}
                          disabled={uploading === student.id}
                        >
                          {uploading === student.id ? (
                            <div className="w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Camera className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" data-testid={`text-tutor-student-${student.id}`}>
                          {student.firstName} {student.lastName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-muted-foreground">{age} años</span>
                          {age >= 18 && <Badge className="text-[10px] px-1 py-0">+18</Badge>}
                        </div>
                      </div>

                      {student.carnetToken && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShare(student)}
                          data-testid={`button-share-tutor-${student.id}`}
                          className="flex-shrink-0"
                        >
                          <QrCode className="w-4 h-4 mr-1" />
                          Carnet
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={!!shareStudent} onOpenChange={(open) => { if (!open) setShareStudent(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Carnet Digital
            </DialogTitle>
          </DialogHeader>
          {shareStudent && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-semibold" data-testid="text-tutor-share-name">
                  {shareStudent.firstName} {shareStudent.lastName}
                </p>
              </div>

              {shareQrUrl && (
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl border shadow-inner">
                    <img src={shareQrUrl} alt="QR del carnet" className="w-56 h-56" data-testid="img-tutor-share-qr" />
                  </div>
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground">
                El alumno puede escanear este QR con su móvil para guardar su carnet digital
              </p>

              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/carnet/${shareStudent.carnetToken}`}
                  className="text-xs"
                  data-testid="input-tutor-share-link"
                />
                <Button size="icon" variant="outline" onClick={copyLink} data-testid="button-tutor-copy-link">
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => window.open(`/carnet/${shareStudent.carnetToken}`, "_blank")}
                data-testid="button-tutor-open-carnet"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Abrir carnet en nueva pestaña
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
