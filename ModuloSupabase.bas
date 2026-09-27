Attribute VB_Name = "ModuloSupabase"
Option Explicit

' =============================================================
' INTEGRACAO EXCEL <-> SUPABASE (T&P MAO / LSL)
' =============================================================
'
' Esta integracao executa o motor Node.js com o Supabase SDK:
'  - Upload instantaneo em lotes de 1000 linhas
'  - Preserva 100% dos dados ja mapeados (IT_IT)
'  - Importa dados direto do Supabase para a aba DADOS_SUPABASE
' =============================================================

Public Sub UploadSaldoEstoque()
    On Error GoTo TrataErro

    Dim pastaProjeto As String
    pastaProjeto = ThisWorkbook.Path

    Dim arquivoExcel As String
    arquivoExcel = ThisWorkbook.FullName

    Application.StatusBar = "Salvando alteracoes no arquivo..."
    ThisWorkbook.Save

    Application.StatusBar = "Enviando saldo para o Supabase..."

    Dim cmd As String
    cmd = "cmd /c cd /d """ & pastaProjeto & """ && node sync_supabase.mjs upload-saldo """ & arquivoExcel & """"

    Dim wsh As Object
    Set wsh = CreateObject("WScript.Shell")

    Dim exitCode As Long
    exitCode = wsh.Run(cmd, 1, True)

    Application.StatusBar = False

    If exitCode = 0 Then
        MsgBox "Saldo de estoque atualizado com sucesso no Supabase!", vbInformation, "T&P - Supabase"
    Else
        MsgBox "Ocorreu um erro ao atualizar o saldo." & vbCrLf & _
               "Verifique a janela de comando para detalhes.", vbCritical, "T&P - Erro"
    End If

    Exit Sub

TrataErro:
    Application.StatusBar = False
    MsgBox "Erro VBA: " & Err.Description, vbCritical
End Sub


Public Sub UploadEstruturaITIT()
    On Error GoTo TrataErro

    Dim pastaProjeto As String
    pastaProjeto = ThisWorkbook.Path

    Dim arquivoExcel As String
    arquivoExcel = ThisWorkbook.FullName

    Application.StatusBar = "Salvando alteracoes no arquivo..."
    ThisWorkbook.Save

    Application.StatusBar = "Sincronizando estrutura IT_IT com o Supabase..."

    Dim cmd As String
    cmd = "cmd /c cd /d """ & pastaProjeto & """ && node sync_supabase.mjs upload-estrutura """ & arquivoExcel & """"

    Dim wsh As Object
    Set wsh = CreateObject("WScript.Shell")

    Dim exitCode As Long
    exitCode = wsh.Run(cmd, 1, True)

    Application.StatusBar = False

    If exitCode = 0 Then
        MsgBox "Estrutura IT_IT sincronizada com sucesso no Supabase!" & vbCrLf & _
               "Todos os SKUs novos/atualizados foram enviados e as medicoes existentes foram 100% preservadas.", _
               vbInformation, "T&P - Supabase"
    Else
        MsgBox "Ocorreu um erro ao sincronizar a estrutura." & vbCrLf & _
               "Verifique a janela de comando para detalhes.", vbCritical, "T&P - Erro"
    End If

    Exit Sub

TrataErro:
    Application.StatusBar = False
    MsgBox "Erro VBA: " & Err.Description, vbCritical
End Sub


Public Sub ImportarDadosMapeados()
    On Error GoTo TrataErro

    Dim pastaProjeto As String
    pastaProjeto = ThisWorkbook.Path

    Dim arquivoCsv As String
    arquivoCsv = pastaProjeto & "\DADOS_SUPABASE.csv"

    Application.StatusBar = "Baixando dados do Supabase..."

    Dim cmd As String
    cmd = "cmd /c cd /d """ & pastaProjeto & """ && node sync_supabase.mjs pull-dados """ & arquivoCsv & """"

    Dim wsh As Object
    Set wsh = CreateObject("WScript.Shell")

    Dim exitCode As Long
    exitCode = wsh.Run(cmd, 1, True)

    If exitCode <> 0 Then
        Application.StatusBar = False
        MsgBox "Erro ao baixar dados do Supabase.", vbCritical
        Exit Sub
    End If

    ' Importa o CSV para a aba DADOS_SUPABASE
    Application.StatusBar = "Carregando dados na planilha..."
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual

    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets("DADOS_SUPABASE")
    On Error GoTo TrataErro

    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add
        ws.Name = "DADOS_SUPABASE"
    End If

    ws.Cells.Clear

    Dim wbCsv As Workbook
    Set wbCsv = Workbooks.Open(Filename:=arquivoCsv, Local:=True)

    wbCsv.Sheets(1).UsedRange.Copy Destination:=ws.Range("A1")
    wbCsv.Close SaveChanges:=False

    ws.Columns.AutoFit

    Application.ScreenUpdating = True
    Application.EnableEvents = True
    Application.Calculation = xlCalculationAutomatic
    Application.StatusBar = False

    Dim totalLinhas As Long
    totalLinhas = ws.Cells(ws.Rows.Count, "B").End(xlUp).Row - 1

    MsgBox totalLinhas & " registros importados com sucesso do Supabase!", vbInformation, "T&P - Supabase"
    Exit Sub

TrataErro:
    Application.ScreenUpdating = True
    Application.EnableEvents = True
    Application.Calculation = xlCalculationAutomatic
    Application.StatusBar = False
    MsgBox "Erro ao importar: " & Err.Description, vbCritical
End Sub