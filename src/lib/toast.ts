import { alertController, toastController } from '@ionic/vue';
export async function showToast(message: string, duration = 2200): Promise<void> {
    const t = await toastController.create({ message, duration, position: 'bottom' });
    await t.present();
}
export async function confirmDialog(header: string, message: string, okText = '确定'): Promise<boolean> {
    const alert = await alertController.create({
        header,
        message,
        buttons: [
            { text: '取消', role: 'cancel' },
            { text: okText, role: 'confirm' },
        ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
}
