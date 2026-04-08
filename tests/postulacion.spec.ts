import { test, expect } from '@playwright/test';

test.describe('Flujo de Postulación', () => {
  test('debe navegar desde el inicio hasta el paso 1 de antecedentes', async ({ page }) => {
    // 1. Ir a la landing page
    await page.goto('/informacion_beca');
    await expect(page).toHaveTitle(/Beca Municipal/);
    
    // 2. Click en "Sí, deseo postular"
    const startButton = page.getByRole('button', { name: 'Sí, deseo postular' });
    await expect(startButton).toBeVisible();
    await startButton.click();
    
    // 3. Verificar navegación a Bienvenida
    await expect(page).toHaveURL(/\/bienvenida_1/);
    await expect(page.getByRole('heading', { name: /Formulario de Postulación/ })).toBeVisible();
    
    // 4. Click en "Comenzar postulación"
    await page.getByRole('button', { name: 'Comenzar postulación' }).click();
    
    // 5. Verificar navegación a Antecedentes (Paso 1)
    await expect(page).toHaveURL(/\/antecedentes_postulante_2/);
    await expect(page.getByText('Paso 1 de 6')).toBeVisible({ timeout: 10000 });
    
    // Usar getByLabel con un poco más de tolerancia o getByRole
    const nameInput = page.getByLabel('Nombres');
    await expect(nameInput).toBeVisible({ timeout: 10000 });
  });

  test('debe validar el formato del RUT en el Paso 1', async ({ page }) => {
    await page.goto('/informacion_beca');
    await page.getByRole('button', { name: 'Sí, deseo postular' }).click();
    await page.getByRole('button', { name: 'Comenzar postulación' }).click();
    
    await expect(page).toHaveURL(/\/antecedentes_postulante_2/);
    
    const rutInput = page.getByLabel('RUT');
    await rutInput.fill('123');
    
    // Click en Siguiente para disparar validación
    await page.getByRole('button', { name: 'Siguiente' }).click();
    
    // Esperar mensaje de error específico del RUT
    await expect(page.getByText('Formato de RUT inválido')).toBeVisible();
  });
});
