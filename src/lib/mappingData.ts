
export const MAPPING_DATA = [
  {
    "name": "Atendimento de KD's da área de Carros",
    "setor": "Recebimento",
    "origem": "Importado",
    "samples": [502.8, 548.0, 617.8, 548.0, 617.8],
    "steps": [
      {
        "name": "RETIRADA DO KD",
        "samples": [150.2, 163.0, 167.7, 163.0, 167.7],
        "substeps": [
          { "name": "Colaborador desloca-se para o botão da rampa de recebimento", "samples": [12.9, 13.3, 12.2, 13.3, 12.2] },
          { "name": "Colaborador realiza a ativação de rampa de acesso", "samples": [20.3, 19.8, 21.6, 19.8, 21.6] },
          { "name": "Colaborador retorna para a empilhadeira", "samples": [12.9, 14.2, 14.3, 14.2, 14.3] },
          { "name": "Colaborador acessa o sistema AS400 para iniciar recebimento via sistema da carreta", "samples": [33.7, 35.9, 33.9, 35.9, 33.9] },
          { "name": "Colaborador desloca-se para dentro da carreta para pegar o KD", "samples": [4.4, 9.9, 11.4, 9.9, 11.4] },
          { "name": "Colaborador faz leitura da fatura do KD e recebe via sistema AS400", "samples": [4.5, 5.6, 4.8, 5.6, 4.8] },
          { "name": "Colaborador eleva o KD para iniciar a retirada", "samples": [7.4, 7.9, 6.4, 7.9, 6.4] },
          { "name": "Colaborador retorna de dentro da carreta com material", "samples": [10.7, 10.2, 11.1, 10.2, 11.1] },
          { "name": "Disponibiliza o KD na área de VANNING LAYOUT", "samples": [30.1, 32.2, 35.4, 32.2, 35.4] },
          { "name": "Retorna do VANNING LAYOUT para a carreta para pegar o próximo", "samples": [13.4, 14.2, 16.7, 14.2, 16.7] }
        ]
      },
      {
        "name": "DISPONIBILIZAÇÃO DE KD EM FARA (FORMATAÇÃO DE CARRO)",
        "samples": [36.8, 37.8, 42.3, 37.8, 42.3],
        "substeps": [
          { "name": "Movimentar-se para área de VANNING LAYOUT", "samples": [7.2, 8.2, 11.6, 8.2, 11.6] },
          { "name": "Pegar KD disponibilizado no VANNING LAYOUT", "samples": [8.7, 5.6, 8.2, 5.6, 8.2] },
          { "name": "Realiza a elevação do KD para iniciar retirada", "samples": [5.7, 5.8, 4.1, 5.8, 4.1] },
          { "name": "Colaborador desloca-se para o inicio da fara de carros", "samples": [8.7, 11.4, 10.2, 11.4, 10.2] },
          { "name": "Colaborador disponibiliza o KD na entrada da área de carros", "samples": [6.5, 6.8, 8.2, 6.8, 8.2] }
        ]
      },
      {
        "name": "ESTOQUE EM FARA (FORMATAÇÃO DE CARRO)",
        "samples": [35.8, 47.9, 45.0, 47.9, 45.0],
        "substeps": [
          { "name": "Colaborador desloca-se para área de entrada da fara", "samples": [4.0, 5.7, 4.1, 5.7, 4.1] },
          { "name": "Faz a elevação do KD Disponibilizado na entrada da área de carros", "samples": [3.6, 4.3, 4.0, 4.3, 4.0] },
          { "name": "Leva o KD para área de fara", "samples": [9.3, 11.7, 14.7, 11.7, 14.7] },
          { "name": "Realiza o acesso ao sistema AS400 para estocagem do KD", "samples": [9.8, 8.4, 10.3, 8.4, 10.3] },
          { "name": "Realiza a leitura da fatura do KD", "samples": [2.8, 3.8, 3.0, 3.8, 3.0] },
          { "name": "Colaborador retorna para área de entrada da fara para pegar outro KD", "samples": [6.4, 14.2, 8.9, 14.2, 8.9] }
        ]
      },
      {
        "name": "DISPONIBILIZAÇÃO DE KD (BANCADA)",
        "samples": [112.8, 124.1, 138.9, 124.1, 138.9],
        "substeps": [
          { "name": "Movimenta-se para a área de FARA de KD", "samples": [5.1, 7.8, 7.2, 7.8, 7.2] },
          { "name": "Procura o KD solicitado na FARA", "samples": [42.4, 35.1, 55.7, 35.1, 55.7] },
          { "name": "Retira o KD solicitado", "samples": [4.7, 6.2, 8.1, 6.2, 8.1] },
          { "name": "Devolver KD's excedentes (caso houver)", "samples": [43.6, 55.1, 45.1, 55.1, 45.1] },
          { "name": "Disponibilizar KD na bancada conforme solicitado", "samples": [11.7, 13.1, 14.0, 13.1, 14.0] },
          { "name": "Ler etiqueta FARA e KD", "samples": [2.9, 4.0, 4.7, 4.0, 4.7] },
          { "name": "Realizar transferência do saldo via AS400", "samples": [2.4, 2.8, 4.3, 2.8, 4.3] }
        ]
      }
    ]
  },
  {
    "name": "Formatação de itens de Carro",
    "setor": "Desconsolidação [Carro]",
    "origem": "Importado",
    "samples": [820.5, 790.2, 850.4, 810.1, 830.3],
    "steps": [
      {
        "name": "IMPRESSÃO DE ETIQUETA DO KD ",
        "samples": [45.2, 42.1, 48.3, 44.5, 46.2],
        "substeps": [
          { "name": "Colaborador desloca-se para parte de trás do KD ", "samples": [5.2, 4.8, 6.1, 5.5, 5.0] },
          { "name": "Acessa  sistema AS400 para iniciar a impressão das etiquetas ", "samples": [10.5, 9.8, 11.2, 10.1, 10.8] },
          { "name": "Realiza leitura da fatura do KD e inicia a impressão", "samples": [8.3, 7.9, 9.1, 8.5, 8.7] },
          { "name": "Desloca-se para impressora ", "samples": [12.4, 11.2, 13.5, 11.8, 12.5] },
          { "name": "Aguarda a impressão das etiquetas ", "samples": [8.8, 8.4, 8.4, 8.6, 9.2] }
        ]
      },
      {
        "name": "ABRIR KD",
        "samples": [120.4, 115.6, 125.8, 118.2, 122.5],
        "substeps": [
          { "name": "Pegar a parafusadeira", "samples": [15.2, 14.8, 16.1, 15.5, 15.0] },
          { "name": "Retirar os parafusos do KD ", "samples": [45.5, 43.2, 47.8, 44.1, 46.5] },
          { "name": "Remover estrutura do KD ", "samples": [20.3, 19.8, 22.1, 20.5, 21.2] },
          { "name": "Retirar resíduos de papelão", "samples": [25.4, 23.8, 26.5, 24.1, 25.8] },
          { "name": "Retornar para a bancada", "samples": [14.0, 14.0, 13.3, 14.1, 14.0] }
        ]
      }
    ]
  }
];
