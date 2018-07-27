chrome.exe --pack-extension=%cd%\RefreshingTieba --pack-extension-key=%cd%\RefreshingTieba.pem
type %cd%\ABP_List_source.txt | py -2 addVersionAndChecksum.py > %cd%\ABP_List.txt