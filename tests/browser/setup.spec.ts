import { test,expect } from '@playwright/test';
test('renders the account screen with a responsive layout and usable keyboard controls',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Welcome to your wardrobe.'})).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Step inside'})).toBeVisible();
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Make room for you.'})).toBeVisible();
  await expect(page.getByLabel('Password',{exact:true})).toHaveAttribute('minlength','8');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.getByLabel('Email address').focus();await page.keyboard.press('Tab');await expect(page.getByLabel('Password',{exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({path:`docs/screenshots/account-${testInfo.project.name}.png`,fullPage:true});
});
test('never presents an unauthenticated closet as owned inventory',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('navigation',{name:'Main navigation'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Add a garment',exact:true})).toHaveCount(0);
});
