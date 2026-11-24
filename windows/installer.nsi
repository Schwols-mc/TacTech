!ifndef APP_VERSION
  !define APP_VERSION "0.0.0.0"
!endif
Unicode true
!include "MUI2.nsh"
Name "TacTech"
OutFile "dist\TacTech_win.exe"
InstallDir "$LOCALAPPDATA\Programs\TacTech"
InstallDirRegKey HKCU "Software\TacTech" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
VIProductVersion "${APP_VERSION}"
VIAddVersionKey /LANG=1055 "ProductName" "TacTech"
VIAddVersionKey /LANG=1055 "FileDescription" "TacTech Kurulum"
VIAddVersionKey /LANG=1055 "CompanyName" "Mehmet Can Biçer"
VIAddVersionKey /LANG=1055 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1055 "LegalCopyright" "Mehmet Can Biçer"

!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\TacTech.exe"
!define MUI_FINISHPAGE_RUN_TEXT "TacTech'i şimdi başlat"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Turkish"

Section "TacTech"
  ; Uygulama açıksa kapat
  nsExec::Exec 'taskkill /F /IM TacTech.exe'
  SetOutPath "$INSTDIR"
  File /r "dist\win-unpacked\*.*"
  File "build\icon.ico"
  WriteRegStr HKCU "Software\TacTech" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Kaldir.exe"
  CreateShortcut "$DESKTOP\TacTech.lnk" "$INSTDIR\TacTech.exe" "" "$INSTDIR\icon.ico"
  CreateDirectory "$SMPROGRAMS\TacTech"
  CreateShortcut "$SMPROGRAMS\TacTech\TacTech.lnk" "$INSTDIR\TacTech.exe" "" "$INSTDIR\icon.ico"
  CreateShortcut "$SMPROGRAMS\TacTech\TacTech'i Kaldır.lnk" "$INSTDIR\Kaldir.exe"
  !define UK "Software\Microsoft\Windows\CurrentVersion\Uninstall\TacTech"
  WriteRegStr HKCU "${UK}" "DisplayName" "TacTech"
  WriteRegStr HKCU "${UK}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UK}" "Publisher" "Mehmet Can Biçer"
  WriteRegStr HKCU "${UK}" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${UK}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UK}" "UninstallString" '"$INSTDIR\Kaldir.exe"'
  WriteRegDWORD HKCU "${UK}" "NoModify" 1
  WriteRegDWORD HKCU "${UK}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM TacTech.exe'
  Delete "$DESKTOP\TacTech.lnk"
  RMDir /r "$SMPROGRAMS\TacTech"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TacTech"
  DeleteRegKey HKCU "Software\TacTech"
SectionEnd
