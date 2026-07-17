"""
Herramienta de un solo uso: obtiene un refresh_token de OAuth 2.0 para leer
Gmail (matiaso81@gmail.com, cuenta personal) desde los scripts de GitHub
Actions de la migracion Relay (Peerberry, MyInvestor, Nominas).

Por que hace falta esto y no alcanza con la cuenta de servicio ya usada
para Drive: una cuenta de servicio de Google solo puede leer un Gmail
ajeno via "domain-wide delegation", que unicamente existe en Google
Workspace (dominios con panel de administracion). Una cuenta @gmail.com
personal no tiene ese mecanismo. La alternativa que si funciona para Gmail
personal es OAuth con refresh_token: se hace el consentimiento una vez de
forma interactiva (este script), y despues cada corrida automatica cambia
el refresh_token por un access_token nuevo sin volver a pedir login.

Uso (correr LOCAL, no en GitHub Actions):
  1. pip install google-auth-oauthlib google-auth --break-system-packages
  2. Crear un OAuth Client ID en Google Cloud Console (ver instrucciones
     que te di en el chat) y descargar el JSON como "client_secret.json"
     en esta misma carpeta.
  3. python get_gmail_refresh_token.py
  4. Se abre el navegador. Iniciar sesion con matiaso81@gmail.com y
     aceptar el permiso de "Ver tus mensajes de email y la configuracion
     de tu cuenta" (gmail.readonly).
  5. El script imprime CLIENT_ID, CLIENT_SECRET y REFRESH_TOKEN. Los tres
     van como secrets nuevos en GitHub (Settings -> Secrets -> Actions):
       GMAIL_CLIENT_ID
       GMAIL_CLIENT_SECRET
       GMAIL_REFRESH_TOKEN
  6. Borrar client_secret.json y no volver a correr este script salvo que
     el refresh_token se revoque.
"""

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

def main():
    flow = InstalledAppFlow.from_client_secrets_file("client_secret.json", SCOPES)
    creds = flow.run_local_server(port=0)

    print("\n--- Guardar estos 3 valores como secrets de GitHub ---")
    print(f"GMAIL_CLIENT_ID={creds.client_id}")
    print(f"GMAIL_CLIENT_SECRET={creds.client_secret}")
    print(f"GMAIL_REFRESH_TOKEN={creds.refresh_token}")
    print("-------------------------------------------------------\n")

    if not creds.refresh_token:
        print(
            "AVISO: no se recibio refresh_token. Esto pasa si ya habias "
            "autorizado este Client ID antes. Ir a "
            "https://myaccount.google.com/permissions, quitar el acceso "
            "de la app, y volver a correr este script."
        )

if __name__ == "__main__":
    main()
