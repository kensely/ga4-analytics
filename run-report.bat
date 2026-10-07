@echo off
chcp 65001 > nul
cd /d "C:\Users\kensely.yu\Desktop\ga4-analytics"
call npm run report >> "C:\Users\kensely.yu\Desktop\ga4-analytics\logs\run.log" 2>&1
