; Refresh Windows shell icon cache after install/update so the new .exe icon
; shows without a full uninstall. (Explorer caches icons by path.)
!macro customInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
