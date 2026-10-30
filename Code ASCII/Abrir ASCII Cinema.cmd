@echo off
setlocal
set "cinemaEdge=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%cinemaEdge%" set "cinemaEdge=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%cinemaEdge%" (
  start "" "%cinemaEdge%" --app="file:///%~dp0index.html"
) else (
  start "" "%~dp0index.html"
)
